import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { flattenJson, unflattenJson } from './json-flatten';

@Injectable()
export class TranslationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async upsert(userId: string, projectId: string, keyId: string, locale: string, value: string) {
    const project = await this.projects.getFor(userId, projectId);
    if (!project.locales.some((l) => l.code === locale)) {
      throw new BadRequestException(`Locale ${locale} is not part of this project`);
    }
    const key = await this.prisma.key.findFirst({ where: { id: keyId, projectId } });
    if (!key) throw new NotFoundException('Key not found');
    return this.prisma.translation.upsert({
      where: { keyId_localeCode: { keyId, localeCode: locale } },
      create: { keyId, projectId, localeCode: locale, value },
      update: { value },
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
    let createdKeys = 0;
    let upserted = 0;
    for (const [name, value] of Object.entries(flat)) {
      const key = await this.prisma.key.upsert({
        where: { projectId_name: { projectId, name } },
        create: { projectId, name },
        update: {},
      });
      if (key.createdAt.getTime() === key.updatedAt.getTime()) createdKeys += 1;
      await this.prisma.translation.upsert({
        where: { keyId_localeCode: { keyId: key.id, localeCode: locale } },
        create: { keyId: key.id, projectId, localeCode: locale, value },
        update: { value },
      });
      upserted += 1;
    }
    return { locale, keysCreated: createdKeys, translationsUpserted: upserted };
  }
}
