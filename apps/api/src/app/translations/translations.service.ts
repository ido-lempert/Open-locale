import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TranslationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ActivityService, truncate } from '../activity/activity.service';
import { flattenJson, unflattenJson } from './json-flatten';

@Injectable()
export class TranslationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
  ) {}

  async upsert(userId: string, projectId: string, keyId: string, locale: string, value: string) {
    const project = await this.projects.getFor(userId, projectId);
    if (!project.locales.some((l) => l.code === locale)) {
      throw new BadRequestException(`Locale ${locale} is not part of this project`);
    }
    const key = await this.prisma.key.findFirst({ where: { id: keyId, projectId } });
    if (!key) throw new NotFoundException('Key not found');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.translation.findUnique({
        where: { keyId_localeCode: { keyId, localeCode: locale } },
      });
      // Editing the text resets review: new wording has not been reviewed.
      const status: TranslationStatus = existing && existing.value === value ? existing.status : 'UNVERIFIED';
      const translation = await tx.translation.upsert({
        where: { keyId_localeCode: { keyId, localeCode: locale } },
        create: { keyId, projectId, localeCode: locale, value },
        update: { value, status },
      });
      if (!existing || existing.value !== value || existing.status !== status) {
        await tx.translationHistory.create({
          data: { keyId, localeCode: locale, value,
            previousValue: existing?.value ?? null, status, changedById: userId },
        });
        await this.activity.record(tx, {
          projectId, actorId: userId, action: 'translation.value',
          keyName: key.name, localeCode: locale,
          detail: { previousValue: truncate(existing?.value ?? ''), value: truncate(value) },
        });
      }
      return translation;
    });
  }

  async setStatus(userId: string, projectId: string, keyId: string, locale: string, status: TranslationStatus) {
    await this.projects.getFor(userId, projectId);
    const existing = await this.prisma.translation.findUnique({
      where: { keyId_localeCode: { keyId, localeCode: locale } },
      include: { key: { select: { name: true } } },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException('Translation not found');
    }
    return this.prisma.$transaction(async (tx) => {
      const translation = await tx.translation.update({
        where: { keyId_localeCode: { keyId, localeCode: locale } },
        data: { status },
      });
      if (existing.status !== status) {
        await tx.translationHistory.create({
          data: { keyId, localeCode: locale, value: existing.value,
            previousValue: existing.value, status, changedById: userId },
        });
        await this.activity.record(tx, {
          projectId, actorId: userId, action: 'translation.status',
          keyName: existing.key.name, localeCode: locale,
          detail: { from: existing.status, to: status },
        });
      }
      return translation;
    });
  }

  async history(userId: string, projectId: string, keyId: string, locale: string) {
    await this.projects.getFor(userId, projectId);
    const key = await this.prisma.key.findFirst({ where: { id: keyId, projectId } });
    if (!key) throw new NotFoundException('Key not found');
    return this.prisma.translationHistory.findMany({
      where: { keyId, localeCode: locale },
      include: { changedBy: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async exportJson(userId: string, projectId: string, locale: string, flat: boolean) {
    await this.projects.getFor(userId, projectId);
    const translations = await this.prisma.translation.findMany({
      where: { projectId, localeCode: locale },
      include: { key: true },
      orderBy: { key: { name: 'asc' } },
    });
    const map: Record<string, string> = {};
    for (const t of translations) map[t.key.name] = t.value;
    return flat ? map : unflattenJson(map);
  }

  async importJson(userId: string, projectId: string, locale: string, entries: Record<string, unknown>) {
    const project = await this.projects.getFor(userId, projectId);
    if (!project.locales.some((l) => l.code === locale)) {
      throw new BadRequestException(`Locale ${locale} is not part of this project`);
    }
    const flat = flattenJson(entries);
    const importId = randomUUID();
    let createdKeys = 0;
    let upserted = 0;
    let skipped = 0;
    for (const [name, value] of Object.entries(flat)) {
      await this.prisma.$transaction(async (tx) => {
        const key = await tx.key.upsert({
          where: { projectId_name: { projectId, name } },
          create: { projectId, name },
          update: {},
        });
        if (key.createdAt.getTime() === key.updatedAt.getTime()) createdKeys += 1;
        const existing = await tx.translation.findUnique({
          where: { keyId_localeCode: { keyId: key.id, localeCode: locale } },
        });
        if (existing && existing.value === value) {
          skipped += 1;
          return;
        }
        // Imported wording replaces the old one and has not been reviewed.
        await tx.translation.upsert({
          where: { keyId_localeCode: { keyId: key.id, localeCode: locale } },
          create: { keyId: key.id, projectId, localeCode: locale, value },
          update: { value, status: 'UNVERIFIED' },
        });
        await tx.translationHistory.create({
          data: {
            keyId: key.id, localeCode: locale, value,
            previousValue: existing?.value ?? null,
            status: 'UNVERIFIED', changedById: userId, importId,
          },
        });
        upserted += 1;
      });
    }
    const summary = { locale, keysCreated: createdKeys, translationsUpserted: upserted, unchangedSkipped: skipped, importId };
    // One feed entry per import run; per-key lineage stays in TranslationHistory
    // (written atomically per key above with the same importId).
    await this.prisma.$transaction((tx) =>
      this.activity.record(tx, {
        projectId, actorId: userId, action: 'project.import', localeCode: locale,
        detail: { keysCreated: createdKeys, translationsUpserted: upserted, unchangedSkipped: skipped, importId },
      }));
    return summary;
  }
}
