import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ActivityService, truncate } from '../activity/activity.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { LocksService } from '../locks/locks.service';
import { BranchesService } from '../branches/branches.service';
import { flattenJson, unflattenJson } from './json-flatten';
import { parseCsv, toCsv } from './csv';
import { parseAndroidXml, toAndroidXml } from './android-xml';
import { parseIosStrings, toIosStrings } from './ios-strings';

// Statuses every project supports; a project may extend this list with
// customStatuses (validated in ProjectsService.updateFor).
export const BASE_STATUSES = ['UNVERIFIED', 'TRANSLATED', 'REVIEWED'] as const;

@Injectable()
export class TranslationsService {
  private assertKnownStatus(project: { customStatuses: string[] }, status: string) {
    if (!(BASE_STATUSES as readonly string[]).includes(status) && !project.customStatuses.includes(status)) {
      throw new BadRequestException(`Unknown status '${status}'. Base statuses or one of the project's custom statuses are allowed`);
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly snapshots: SnapshotsService,
    private readonly locks: LocksService,
    private readonly webhooks: WebhooksService,
    private readonly branches: BranchesService,
  ) {}

  async upsert(userId: string, projectId: string, keyId: string, locale: string, value: string) {
    await this.projects.assertLocaleWrite(userId, projectId, [locale]);
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
      const status = existing && existing.value === value ? existing.status : 'UNVERIFIED';
      const translation = await tx.translation.upsert({
        where: { keyId_localeCode: { keyId, localeCode: locale } },
        create: { keyId, projectId, localeCode: locale, value },
        update: { value, status },
      });
      if (value) await this.rememberTx(tx, projectId, project.baseLocale, keyId, locale, value);
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
    }).then((translation) => {
      // Webhooks are fire-and-forget: delivery must never fail the write.
      this.webhooks.deliver(projectId, 'translation.updated', {
        key: key.name, locale, value,
      }).catch(() => {});
      return translation;
    });
  }

  // Review queue bulk transition: set one status for many translations in a
  // single locale at once. The update is ONE atomic UPDATE ... RETURNING whose
  // WHERE re-checks every condition at write time, so a concurrent edit that
  // changes a row's status or value after a preview excludes that row from the
  // commit. Scope: the given locale only; only rows whose CURRENT status
  // matches `from` (when given); optionally narrowed to keys matching search/
  // tag; empty values are never marked reviewed-or-anything (an empty string
  // is not a translation). dryRun returns the count without writing.
  async bulkSetStatus(userId: string, projectId: string, input: {
    locale: string; status: string; from?: string; search?: string; tag?: string; keyIds?: string[]; branch?: string; dryRun?: boolean; notChangedSince?: string;
  }) {
    const { locale, status, from, search, tag, keyIds, branch, dryRun, notChangedSince } = input;
    await this.projects.assertLocaleWrite(userId, projectId, [locale]);
    const project = await this.projects.getFor(userId, projectId);
    this.assertKnownStatus(project, status);
    if (!project.locales.some((l) => l.code === locale)) {
      throw new BadRequestException(`Locale ${locale} is not part of this project`);
    }
    const branchRow = await this.branches.branchFor(projectId, branch);
    const keyConditions = [
      Prisma.sql`k."projectId" = ${projectId}::uuid`,
      Prisma.sql`k."branchId" = ${branchRow.id}::uuid`,
    ];
    if (search) keyConditions.push(Prisma.sql`k."name" ILIKE ${'%' + search + '%'}`);
    if (tag) keyConditions.push(Prisma.sql`k."tags" @> ARRAY[${tag}]::text[]`);
    if (keyIds?.length) keyConditions.push(Prisma.sql`k."id" = ANY(${keyIds}::uuid[])`);
    const conditions = [
      Prisma.sql`t."projectId" = ${projectId}::uuid`,
      Prisma.sql`t."localeCode" = ${locale}`,
      Prisma.sql`t."status" <> ${status}`,
      Prisma.sql`t."value" <> ''`,
      ...(from ? [Prisma.sql`t."status" = ${from}`] : []),
      Prisma.sql`t."keyId" IN (SELECT k."id" FROM "keys" k WHERE ${Prisma.join(keyConditions, ' AND ')})`,
    ];
    // Optimistic preview: the client passes the preview's DB-server time back
    // as notChangedSince, so any row written after the preview (value edit,
    // status round-trip, newly matching row) is excluded from the commit.
    // updatedAt bumps on every write; the timestamp comes from the DB server,
    // not the client, so there is no clock-skew window.
    // updatedAt columns are timestamp-without-tz holding UTC wall time, so
    // the preview timestamp is produced and compared as a naive UTC literal:
    // no session-timezone conversion can shift the window.
    if (notChangedSince !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(notChangedSince)) {
        throw new BadRequestException('notChangedSince must be the previewAt value from a dry-run preview');
      }
      conditions.push(Prisma.sql`t."updatedAt" <= ${notChangedSince}::timestamp`);
    }
    const where = Prisma.join(conditions, ' AND ');
    if (dryRun) {
      // statement_timestamp() matches the READ COMMITTED statement snapshot
      // that count(*) actually sees (now() is transaction start and could be
      // earlier); microseconds match updatedAt's stored precision.
      const rows = await this.prisma.$queryRaw<{ count: bigint; now: string }[]>(
        Prisma.sql`SELECT count(*) AS count, to_char(statement_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS now FROM "translations" t WHERE ${where}`);
      return { matched: Number(rows[0].count), updated: 0, previewAt: rows[0].now };
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.$queryRaw<{ keyId: string; value: string }[]>(
        Prisma.sql`UPDATE "translations" t SET "status" = ${status} WHERE ${where} RETURNING t."keyId" AS "keyId", t."value" AS "value"`);
      if (updated.length) {
        await tx.translationHistory.createMany({
          data: updated.map((t) => ({ keyId: t.keyId, localeCode: locale, value: t.value, previousValue: t.value, status, changedById: userId })),
        });
        await this.activity.record(tx, {
          projectId, actorId: userId, action: 'translation.status',
          detail: { bulk: true, locale, to: status, from: from ?? null, count: updated.length },
        });
      }
      return { matched: updated.length, updated: updated.length, previewAt: null };
    });
  }

  async setStatus(userId: string, projectId: string, keyId: string, locale: string, status: string) {
    await this.projects.assertLocaleWrite(userId, projectId, [locale]);
    const project = await this.projects.getFor(userId, projectId);
    this.assertKnownStatus(project, status);
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

  // Auto-populate translation memory from a saved target value. Empty sources
  // or targets are never remembered; base-locale saves are their own source.
  private async rememberTx(tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    projectId: string, baseLocale: string, keyId: string, locale: string, value: string) {
    if (!value || locale === baseLocale) return;
    const source = await tx.translation.findUnique({
      where: { keyId_localeCode: { keyId, localeCode: baseLocale } },
    });
    if (!source?.value) return;
    await tx.tmEntry.upsert({
      where: {
        projectId_localeCode_sourceLocaleCode_sourceText: {
          projectId, localeCode: locale, sourceLocaleCode: baseLocale, sourceText: source.value,
        },
      },
      create: { projectId, localeCode: locale, sourceLocaleCode: baseLocale, sourceText: source.value, targetText: value, keyId },
      update: { targetText: value, keyId },
    });
  }

  // Dice bigram similarity 0..1 - no extensions needed; pg_trgm is a Phase 2 scale item.
  private static similarity(a: string, b: string): number {
    const grams = (s: string) => {
      const g = new Map<string, number>();
      const t = s.toLowerCase();
      for (let i = 0; i < t.length - 1; i++) g.set(t.slice(i, i + 2), (g.get(t.slice(i, i + 2)) ?? 0) + 1);
      return g;
    };
    if (!a || !b) return 0;
    if (a === b) return 1;
    const ga = grams(a), gb = grams(b);
    let overlap = 0;
    for (const [g, n] of ga) overlap += Math.min(n, gb.get(g) ?? 0);
    return (2 * overlap) / (a.length - 1 + (b.length - 1));
  }

  async suggest(userId: string, projectId: string, locale: string, source: string) {
    const project = await this.projects.getFor(userId, projectId);
    if (!project.locales.some((l) => l.code === locale) || locale === project.baseLocale) {
      throw new BadRequestException(`Locale ${locale} is not a target locale of this project`);
    }
    if (!source.trim()) return { suggestions: [] };
    const entries = await this.prisma.tmEntry.findMany({
      where: { projectId, localeCode: locale, targetText: { not: '' } },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    const scored = entries
      .map((e) => ({ sourceText: e.sourceText, targetText: e.targetText, score: TranslationsService.similarity(source, e.sourceText) }))
      .filter((e) => e.score >= 0.5)
      .sort((x, y) => y.score - x.score)
      .slice(0, 5);
    return { suggestions: scored };
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

  async exportJson(userId: string, projectId: string, locale: string, flat: boolean, branch?: string) {
    await this.projects.getFor(userId, projectId);
    const b = await this.branches.branchFor(projectId, branch);
    const translations = await this.prisma.translation.findMany({
      where: { projectId, localeCode: locale, key: { branchId: b.id } },
      include: { key: true },
      orderBy: { key: { name: 'asc' } },
    });
    const map: Record<string, string> = {};
    for (const t of translations) map[t.key.name] = t.value;
    return flat ? map : unflattenJson(map);
  }

  async exportCsv(userId: string, projectId: string, locale: string, mode?: string, branch?: string) {
    const flat = (await this.exportJson(userId, projectId, locale, true, branch)) as Record<string, string>;
    return toCsv(Object.entries(flat).sort(([a], [b]) => a.localeCompare(b)), { spreadsheetSafe: mode !== 'raw' });
  }

  async exportAndroid(userId: string, projectId: string, locale: string, branch?: string) {
    const flat = (await this.exportJson(userId, projectId, locale, true, branch)) as Record<string, string>;
    return toAndroidXml(Object.entries(flat).sort(([a], [b]) => a.localeCompare(b)));
  }

  async exportIos(userId: string, projectId: string, locale: string, branch?: string) {
    const flat = (await this.exportJson(userId, projectId, locale, true, branch)) as Record<string, string>;
    return toIosStrings(Object.entries(flat).sort(([a], [b]) => a.localeCompare(b)));
  }

  async importAndroid(userId: string, projectId: string, locale: string, xml: string, branch?: string) {
    const { rows, rejected } = parseAndroidXml(xml);
    if (rejected > 0) {
      throw new BadRequestException(`${rejected} unsupported or unparsable element(s) in Android XML: plurals, string-array, DOCTYPE/entity declarations and nested markup are not supported`);
    }
    return this.importJson(userId, projectId, locale, Object.fromEntries(rows), branch);
  }

  async importIos(userId: string, projectId: string, locale: string, strings: string, branch?: string) {
    const { rows, rejected } = parseIosStrings(strings);
    if (rejected > 0) {
      throw new BadRequestException(`${rejected} line(s) are not valid "key" = "value"; entries`);
    }
    return this.importJson(userId, projectId, locale, Object.fromEntries(rows), branch);
  }

  async importCsv(userId: string, projectId: string, locale: string, csv: string, branch?: string) {
    const { rows, rejected } = parseCsv(csv);
    if (rejected > 0) {
      throw new BadRequestException(`${rejected} CSV row(s) have more than 2 columns`);
    }
    return this.importJson(userId, projectId, locale, Object.fromEntries(rows), branch);
  }

  async importJson(userId: string, projectId: string, locale: string, entries: Record<string, unknown>, branch?: string) {
    await this.projects.assertLocaleWrite(userId, projectId, [locale]);
    const b = await this.branches.branchFor(projectId, branch);
    const project = await this.projects.getFor(userId, projectId);
    if (!project.locales.some((l) => l.code === locale)) {
      throw new BadRequestException(`Locale ${locale} is not part of this project`);
    }
    const { flat, rejected } = flattenJson(entries);
    // Serialize bulk mutations per project (imports and restores share the
    // same lock) so automatic snapshots capture an authoritative pre-mutation
    // state. Single-instance in-process mutex; see LocksService for why not a
    // Postgres advisory lock and what multi-instance needs.
    return this.locks.withProjectLock(projectId, () =>
      this.importJsonLocked(userId, projectId, locale, project.baseLocale, entries, flat, rejected, b.id));
  }

  private async importJsonLocked(
    userId: string, projectId: string, locale: string, baseLocale: string,
    entries: Record<string, unknown>, flat: Record<string, string>, rejected: string[],
    branchId: string,
  ) {
    // Restorable auto snapshot BEFORE anything mutates: every import leaves the
    // pre-import state recoverable from the snapshots list.
    await this.snapshots.captureAutomatic(projectId, `before import ${locale}`, userId);
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
            where: { branchId_name: { branchId, name } },
            create: { projectId, branchId, name },
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
          if (value) await this.rememberTx(tx, projectId, baseLocale, key.id, locale, value);
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
