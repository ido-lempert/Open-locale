import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ActivityService } from '../activity/activity.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { driverFor } from './mt.providers';
import { CreateMtProviderDto, PretranslateDto, UpdateMtProviderDto, MT_BATCH_CAP } from './dto';

@Injectable()
export class MtService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly webhooks: WebhooksService,
  ) {}

  async listProviders(userId: string, projectId: string) {
    await this.projects.getFor(userId, projectId);
    return this.prisma.mtProvider.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
  }

  async createProvider(userId: string, projectId: string, dto: CreateMtProviderDto) {
    await this.projects.requireAdmin(userId, projectId);
    try {
      return await this.prisma.mtProvider.create({
        data: { projectId, name: dto.name, type: dto.type, config: (dto.config ?? {}) as Prisma.InputJsonValue, enabled: dto.enabled ?? true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`A provider named '${dto.name}' already exists in this project`);
      }
      throw e;
    }
  }

  async updateProvider(userId: string, projectId: string, providerId: string, dto: UpdateMtProviderDto) {
    await this.projects.requireAdmin(userId, projectId);
    const provider = await this.prisma.mtProvider.findFirst({ where: { id: providerId, projectId } });
    if (!provider) throw new NotFoundException('Provider not found');
    try {
      return await this.prisma.mtProvider.update({
        where: { id: provider.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
          ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`A provider named '${dto.name}' already exists in this project`);
      }
      throw e;
    }
  }

  async removeProvider(userId: string, projectId: string, providerId: string) {
    await this.projects.requireAdmin(userId, projectId);
    const provider = await this.prisma.mtProvider.findFirst({ where: { id: providerId, projectId } });
    if (!provider) throw new NotFoundException('Provider not found');
    await this.prisma.mtProvider.delete({ where: { id: provider.id } });
    return { deleted: true };
  }

  // Pre-translate EMPTY target rows only. Fills missing or empty translations
  // from the source locale via the provider driver; never touches a
  // non-empty value. The write itself is conditional (INSERT .. ON CONFLICT
  // .. DO UPDATE .. WHERE value=''), so a value written by anyone between
  // our read and our write is kept, not clobbered.
  async pretranslate(userId: string, projectId: string, dto: PretranslateDto) {
    await this.projects.assertLocaleWrite(userId, projectId, [dto.locale]);
    const project = await this.projects.getFor(userId, projectId);
    const codes = project.locales.map((l) => l.code);
    if (!codes.includes(dto.locale)) throw new BadRequestException(`Locale ${dto.locale} is not part of this project`);
    const sourceLocale = dto.sourceLocale ?? project.baseLocale;
    if (!codes.includes(sourceLocale)) throw new BadRequestException(`Source locale ${sourceLocale} is not part of this project`);
    if (dto.locale === sourceLocale) throw new BadRequestException('Target and source locale must differ');

    const provider = await this.prisma.mtProvider.findFirst({ where: { id: dto.providerId, projectId } });
    if (!provider) throw new NotFoundException('Provider not found');
    if (!provider.enabled) throw new BadRequestException(`Provider '${provider.name}' is disabled`);
    const driver = driverFor(provider.type);
    if (!driver) throw new BadRequestException(`Provider type '${provider.type}' has no installed driver`);

    const branchName = dto.branch ?? 'main';
    const branch = await this.prisma.branch.findFirst({ where: { projectId, name: branchName } });
    if (!branch) throw new BadRequestException(`Branch '${branchName}' does not exist in this project`);
    const keys = await this.prisma.key.findMany({
      where: { projectId, branchId: branch.id, ...(dto.keyIds ? { id: { in: dto.keyIds } } : {}) },
      include: { translations: true },
      orderBy: { name: 'asc' },
    });
    if (keys.length > MT_BATCH_CAP) {
      throw new BadRequestException(`Pre-translate is limited to ${MT_BATCH_CAP} keys per run; got ${keys.length}. Narrow with keyIds.`);
    }

    const work: { keyId: string; keyName: string; source: string }[] = [];
    let skippedExisting = 0, skippedNoSource = 0;
    for (const key of keys) {
      const target = key.translations.find((t) => t.localeCode === dto.locale);
      if (target && target.value !== '') { skippedExisting++; continue; }
      const source = key.translations.find((t) => t.localeCode === sourceLocale)?.value ?? '';
      if (source === '') { skippedNoSource++; continue; }
      work.push({ keyId: key.id, keyName: key.name, source });
    }

    const translated = work.length
      ? await driver.translate(work.map((w) => w.source), sourceLocale, dto.locale, (provider.config ?? {}) as Record<string, unknown>)
      : [];

    let written = 0;
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < work.length; i++) {
        // Conditional check-and-write in the writing statement itself: only
        // rows that are STILL empty (or still absent) accept the MT value.
        const rows = await tx.$queryRaw<{ keyId: string }[]>`
          INSERT INTO "translations" ("keyId", "projectId", "localeCode", "value", "status", "version", "updatedAt")
          VALUES (${work[i].keyId}::uuid, ${projectId}::uuid, ${dto.locale}, ${translated[i]}, 'UNVERIFIED', 1, now())
          ON CONFLICT ("keyId", "localeCode")
          DO UPDATE SET "value" = EXCLUDED."value", "status" = 'UNVERIFIED',
                        "version" = "translations"."version" + 1, "updatedAt" = now()
          WHERE "translations"."value" = ''
          RETURNING "keyId"`;
        if (!rows[0]) continue; // someone wrote a value meanwhile - keep it
        written++;
        await tx.translationHistory.create({
          data: { keyId: work[i].keyId, localeCode: dto.locale, value: translated[i], previousValue: '', status: 'UNVERIFIED', changedById: userId },
        });
      }
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'mt.pretranslate', localeCode: dto.locale,
        detail: { provider: provider.name, type: provider.type, sourceLocale, branch: branchName, translated: written, skippedExisting, skippedNoSource },
      });
    });

    this.webhooks.deliver(projectId, 'mt.pretranslated', {
      provider: provider.name, locale: dto.locale, sourceLocale, branch: branchName, translated: written,
    }).catch(() => {});

    return { translated: written, skippedExisting, skippedNoSource, totalKeys: keys.length };
  }
}
