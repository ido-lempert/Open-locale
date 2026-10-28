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
    const { flat, rejected } = flattenJson(entries);
    // The run row is committed BEFORE any key is touched: a crash mid-import
    // always leaves a durable, audited record of what was attempted.
    const run = await this.prisma.importRun.create({
      data: { projectId, localeCode: locale, actorId: userId, failed: rejected.length },
    });
    let firstError: string | null = rejected.length
      ? `Non-string values rejected for: ${rejected.slice(0, 5).join(', ')}`
      : null;
    let failed = rejected.length;
    for (const [name, value] of Object.entries(flat)) {
      try {
        // Each key's change, its history row and the run's counters commit in
        // one transaction - progress on the run row always matches the data.
        await this.prisma.$transaction(async (tx) => {
          const key = await tx.key.upsert({
            where: { projectId_name: { projectId, name } },
            create: { projectId, name },
            update: {},
          });
          const keyCreated = key.createdAt.getTime() === key.updatedAt.getTime();
          const existing = await tx.translation.findUnique({
            where: { keyId_localeCode: { keyId: key.id, localeCode: locale } },
          });
          if (existing && existing.value === value) {
            await tx.importRun.update({
              where: { id: run.id }, data: { unchangedSkipped: { increment: 1 } },
            });
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
              status: 'UNVERIFIED', changedById: userId, importId: run.id,
            },
          });
          await tx.importRun.update({
            where: { id: run.id },
            data: {
              translationsUpserted: { increment: 1 },
              ...(keyCreated ? { keysCreated: { increment: 1 } } : {}),
            },
          });
        });
      } catch (e) {
        failed += 1;
        const message = e instanceof Error ? e.message : String(e);
        firstError ??= `${name}: ${truncate(message, 120)}`;
        await this.prisma.importRun.update({
          where: { id: run.id },
          data: { failed: { increment: 1 }, error: truncate(firstError) },
        });
      }
    }
    const counters = await this.prisma.importRun.findUniqueOrThrow({ where: { id: run.id } });
    const status = failed > 0
      ? (counters.translationsUpserted + counters.unchangedSkipped > 0 ? 'PARTIAL' : 'FAILED')
      : 'COMPLETED';
    // Terminal status and the feed's summary event commit together.
    const finished = await this.prisma.$transaction(async (tx) => {
      const row = await tx.importRun.update({
        where: { id: run.id },
        data: { status, ...(firstError ? { error: truncate(firstError) } : {}) },
      });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'project.import', localeCode: locale,
        detail: {
          keysCreated: row.keysCreated, translationsUpserted: row.translationsUpserted,
          unchangedSkipped: row.unchangedSkipped, failed: row.failed,
          status, importId: run.id,
        },
      });
      return row;
    });
    return {
      locale, keysCreated: finished.keysCreated, translationsUpserted: finished.translationsUpserted,
      unchangedSkipped: finished.unchangedSkipped, failed: finished.failed,
      status, ...(finished.error ? { error: finished.error } : {}), importId: run.id,
    };
  }

  async listImportRuns(userId: string, projectId: string) {
    await this.projects.getFor(userId, projectId);
    return this.prisma.importRun.findMany({
      where: { projectId },
      include: { actor: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
