import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ActivityService, truncate } from '../activity/activity.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { LocksService } from '../locks/locks.service';
import { BranchesService } from '../branches/branches.service';
import { AutomationsService } from '../automations/automations.service';
import { TasksService } from '../tasks/tasks.service';
import { flattenJson, unflattenJson } from './json-flatten';
import type { ImportJsonDto } from './dto';
import { parseCsv, toCsv } from './csv';
import { parseAndroidXml, toAndroidXml } from './android-xml';
import { parseStringsdict, toStringsdict } from './stringsdict';
import { parsePo, toPo, toPot } from './po';
import { toTmx } from './tmx';
import { parseXliff, toXliff } from './xliff';
import { parseResx, toResx } from './resx';
import { parseProperties, toProperties } from './properties';
import { parseArb, toArb } from './arb';
import { parseYaml, toYaml } from './yaml';
import { parseIosStrings, toIosStrings } from './ios-strings';
import { buildZip, readZip, zipSafeName } from './zip';

// Statuses every project supports; a project may extend this list with
// customStatuses (validated in ProjectsService.updateFor).
export const BASE_STATUSES = ['UNVERIFIED', 'TRANSLATED', 'REVIEWED'] as const;

// Canonical comparison for pluralForms read back from jsonb (key order is
// normalized by PostgreSQL) vs the caller's object (arbitrary order).
const canonPlural = (v: unknown): string =>
  v == null ? 'null' : JSON.stringify(Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1))));

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
    private readonly automations: AutomationsService,
    private readonly tasks: TasksService,
  ) {}

  async upsert(userId: string, projectId: string, keyId: string, locale: string, value: string, expectedVersion?: number, expectedRowId?: string, pluralForms?: Record<string, string> | null) {
    await this.projects.assertLocaleWrite(userId, projectId, [locale]);
    const project = await this.projects.getFor(userId, projectId);
    if (!project.locales.some((l) => l.code === locale)) {
      throw new BadRequestException(`Locale ${locale} is not part of this project`);
    }
    const key = await this.prisma.key.findFirst({ where: { id: keyId, projectId }, include: { branch: true } });
    if (!key) throw new NotFoundException('Key not found');
    // null is treated as omitted: plural forms are cleared by marking the key
    // non-plural (keys.service), never by sending null here.
    if (pluralForms == null) pluralForms = undefined;
    if (pluralForms !== undefined) {
      if (!key.isPlural || Array.isArray(pluralForms)) {
        throw new BadRequestException('pluralForms is an object of CLDR category to text, only for keys marked plural (isPlural)');
      }
      let allowed: string[];
      try {
        allowed = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
      } catch {
        throw new BadRequestException(`No CLDR plural rules for locale ${locale}`);
      }
      const cats = Object.keys(pluralForms);
      const invalid = cats.filter((c) => !allowed.includes(c));
      if (invalid.length) {
        throw new BadRequestException(`Locale ${locale} has no plural categories: ${invalid.join(', ')} (allowed: ${allowed.join(', ')})`);
      }
      if (!cats.includes('other')) throw new BadRequestException('pluralForms must include the "other" category');
      for (const [c, v] of Object.entries(pluralForms)) {
        if (typeof v !== 'string') throw new BadRequestException(`pluralForms.${c} must be a string`);
      }
    }
    return this.prisma.$transaction(async (tx) => {
      // Task key lock: rejects when an open lockKeys task covers this key
      // and the caller is neither its assignee (direct/group) nor an admin.
      await this.tasks.assertKeysEditable(tx, userId, projectId, [keyId]);
      let existing: { value: string; status: string; version: number; rowId?: string; pluralForms?: unknown } | null;
      if (expectedVersion !== undefined) {
        // Optimistic concurrency: lock the row first, then compare the locked
        // version, so the value checked is exactly the value overwritten.
        // A missing row is version 0 - an expectedVersion of 0 asserts
        // "no translation yet" and races with a concurrent create.
        const locked = await tx.$queryRaw<{ value: string; status: string; version: number; rowId: string; pluralForms: unknown }[]>`
          SELECT "value", "status", "version", "rowId", "pluralForms" FROM "translations"
          WHERE "keyId" = ${keyId}::uuid AND "localeCode" = ${locale} FOR UPDATE`;
        existing = locked[0] ?? null;
        const currentVersion = existing ? existing.version : 0;
        // Version AND immutable row identity: a recreated row that climbs back
        // to the same version number still fails on rowId.
        const identityMismatch = expectedRowId !== undefined && existing && existing.rowId !== expectedRowId;
        if (currentVersion !== expectedVersion || identityMismatch) {
          throw new ConflictException({
            message: 'This translation changed since it was loaded.',
            currentValue: existing ? existing.value : null,
            currentVersion,
            currentRowId: existing ? existing.rowId : null,
          });
        }
      } else {
        existing = await tx.translation.findUnique({
          where: { keyId_localeCode: { keyId, localeCode: locale } },
        });
      }
      // Editing the text resets review: new wording has not been reviewed.
      const status = existing && existing.value === value ? existing.status : 'UNVERIFIED';
      let translation;
      if (!existing && expectedVersion !== undefined) {
        // Create-only write: ON CONFLICT DO NOTHING turns a concurrent create
        // into a conflict instead of a silent overwrite.
        const created = await tx.$queryRaw<{ keyId: string }[]>`
          INSERT INTO "translations" ("keyId", "projectId", "localeCode", "value", "status", "version", "pluralForms", "updatedAt")
          VALUES (${keyId}::uuid, ${projectId}::uuid, ${locale}, ${value}, ${status}, 1, ${pluralForms ? JSON.stringify(pluralForms) : null}::jsonb, now())
          ON CONFLICT ("keyId", "localeCode") DO NOTHING RETURNING "keyId"`;
        if (!created[0]) {
          throw new ConflictException({ message: 'This translation was created concurrently.', currentValue: null, currentVersion: null });
        }
        translation = await tx.translation.findUniqueOrThrow({ where: { keyId_localeCode: { keyId, localeCode: locale } } });
      } else {
        translation = await tx.translation.upsert({
          where: { keyId_localeCode: { keyId, localeCode: locale } },
          create: { keyId, projectId, localeCode: locale, value, version: 1, ...(pluralForms ? { pluralForms } : {}) },
          update: { value, status, version: { increment: 1 }, ...(pluralForms ? { pluralForms } : {}) },
        });
      }
      if (value) await this.rememberTx(tx, projectId, project.baseLocale, keyId, locale, value);
      const pluralChanged = pluralForms !== undefined && canonPlural(existing?.pluralForms) !== canonPlural(pluralForms);
      if (!existing || existing.value !== value || existing.status !== status || pluralChanged) {
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
      // Automations fire-and-forget too; the service enforces the trigger
      // bounds (main branch, base locale) and never throws.
      this.automations.fire(projectId, 'translation.value', {
        keyId, keyName: key.name, branchName: key.branch.name, localeCode: locale, actorId: userId,
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
        Prisma.sql`UPDATE "translations" t SET "status" = ${status}, "version" = t."version" + 1 WHERE ${where} RETURNING t."keyId" AS "keyId", t."value" AS "value"`);
      // Task key locks apply to bulk status moves too; a violation throws
      // and rolls the whole UPDATE back (no partial bulk commit).
      if (updated.length) await this.tasks.assertKeysEditable(tx, userId, projectId, updated.map((t) => t.keyId));
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
      await this.tasks.assertKeysEditable(tx, userId, projectId, [keyId]);
      const translation = await tx.translation.update({
        where: { keyId_localeCode: { keyId, localeCode: locale } },
        // Status changes bump the value-conflict token too: an in-context
        // frame holding the old version must conflict instead of silently
        // resetting a newer review decision by saving text over it.
        data: { status, version: { increment: 1 } },
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

  async exportTmx(userId: string, projectId: string, locale: string) {
    const project = await this.projects.getFor(userId, projectId);
    if (!project.locales.some((l) => l.code === locale) || locale === project.baseLocale) {
      throw new BadRequestException(`Locale ${locale} is not a target locale of this project`);
    }
    const entries = await this.prisma.tmEntry.findMany({
      where: { projectId, localeCode: locale, sourceLocaleCode: project.baseLocale, targetText: { not: '' } },
      orderBy: { sourceText: 'asc' },
    });
    return toTmx(entries.map((e): [string, string] => [e.sourceText, e.targetText]), project.baseLocale, locale);
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
    await this.projects.getFor(userId, projectId);
    const b = await this.branches.branchFor(projectId, branch);
    const translations = await this.prisma.translation.findMany({
      where: { projectId, localeCode: locale, key: { branchId: b.id } },
      include: { key: true },
      orderBy: { key: { name: 'asc' } },
    });
    const rows: [string, string][] = [];
    const plurals: [string, Record<string, string>][] = [];
    for (const t of translations) {
      const forms = t.pluralForms as Record<string, string> | null;
      // Plural key with stored forms -> <plurals>. A plural key without forms
      // falls back to a plain <string> from value (documented, lossy for the
      // plural intent but valid Android).
      if (t.key.isPlural && forms && Object.keys(forms).length > 0) plurals.push([t.key.name, forms]);
      else rows.push([t.key.name, t.value]);
    }
    return toAndroidXml(rows, plurals);
  }

  async exportStringsdict(userId: string, projectId: string, locale: string, branch?: string) {
    await this.projects.getFor(userId, projectId);
    const b = await this.branches.branchFor(projectId, branch);
    const translations = await this.prisma.translation.findMany({
      where: { projectId, localeCode: locale, key: { branchId: b.id, isPlural: true } },
      include: { key: true },
      orderBy: { key: { name: 'asc' } },
    });
    const plurals: [string, Record<string, string>][] = [];
    for (const t of translations) {
      const forms = t.pluralForms as Record<string, string> | null;
      // Only plural keys WITH stored forms appear; a plural key without
      // forms has no stringsdict representation (documented).
      if (forms && Object.keys(forms).length > 0) plurals.push([t.key.name, forms]);
    }
    return toStringsdict(plurals);
  }

  async exportIos(userId: string, projectId: string, locale: string, branch?: string) {
    const flat = (await this.exportJson(userId, projectId, locale, true, branch)) as Record<string, string>;
    return toIosStrings(Object.entries(flat).sort(([a], [b]) => a.localeCompare(b)));
  }

  async exportPo(userId: string, projectId: string, locale: string, branch?: string) {
    const flat = (await this.exportJson(userId, projectId, locale, true, branch)) as Record<string, string>;
    return toPo(Object.entries(flat).sort(([a], [b]) => a.localeCompare(b)));
  }

  async exportPot(userId: string, projectId: string, locale: string, branch?: string) {
    const flat = (await this.exportJson(userId, projectId, locale, true, branch)) as Record<string, string>;
    return toPot(Object.entries(flat).sort(([a], [b]) => a.localeCompare(b)));
  }

  async exportXliff(userId: string, projectId: string, locale: string, branch?: string) {
    const flat = (await this.exportJson(userId, projectId, locale, true, branch)) as Record<string, string>;
    const project = await this.projects.getFor(userId, projectId);
    return toXliff(Object.entries(flat).sort(([a], [b]) => a.localeCompare(b)), project.baseLocale, locale);
  }

  async exportResx(userId: string, projectId: string, locale: string, branch?: string) {
    const flat = (await this.exportJson(userId, projectId, locale, true, branch)) as Record<string, string>;
    return toResx(Object.entries(flat).sort(([a], [b]) => a.localeCompare(b)));
  }

  async exportProperties(userId: string, projectId: string, locale: string, branch?: string) {
    const flat = (await this.exportJson(userId, projectId, locale, true, branch)) as Record<string, string>;
    return toProperties(Object.entries(flat).sort(([a], [b]) => a.localeCompare(b)));
  }

  async exportArb(userId: string, projectId: string, locale: string, branch?: string) {
    const flat = (await this.exportJson(userId, projectId, locale, true, branch)) as Record<string, string>;
    return toArb(Object.entries(flat).sort(([a], [b]) => a.localeCompare(b)), locale);
  }

  async exportYaml(userId: string, projectId: string, locale: string, branch?: string) {
    const flat = (await this.exportJson(userId, projectId, locale, true, branch)) as Record<string, string>;
    return toYaml(Object.entries(flat).sort(([a], [b]) => a.localeCompare(b)), locale);
  }

  // Export every project locale (base included) as one store-only zip with
  // one entry per locale in the requested format. Same read boundary as the
  // single-locale exports (team membership via projects.getFor); the branch
  // query scopes entries the same way. Entry bytes reuse the per-locale
  // exporters, so text formats are byte-equal to their single-locale
  // endpoints; the json entry is the flat map pretty-printed (the flat
  // endpoint body is the same map, serialized without whitespace).
  async exportBundle(userId: string, projectId: string, format: string, branch?: string, mode?: string): Promise<{ zip: Buffer; filename: string }> {
    const exporters: Record<string, { ext: string; run: (locale: string) => Promise<string> }> = {
      json: { ext: '.json', run: async (l) => JSON.stringify(await this.exportJson(userId, projectId, l, true, branch), null, 2) + '\n' },
      // Same default as the single-locale CSV export: spreadsheet-safe.
      // mode=raw opts into the lossless variant explicitly.
      csv: { ext: '.csv', run: (l) => this.exportCsv(userId, projectId, l, mode, branch) },
      android: { ext: '.xml', run: (l) => this.exportAndroid(userId, projectId, l, branch) },
      ios: { ext: '.strings', run: (l) => this.exportIos(userId, projectId, l, branch) },
      stringsdict: { ext: '.stringsdict', run: (l) => this.exportStringsdict(userId, projectId, l, branch) },
      po: { ext: '.po', run: (l) => this.exportPo(userId, projectId, l, branch) },
      pot: { ext: '.pot', run: (l) => this.exportPot(userId, projectId, l, branch) },
      xliff: { ext: '.xlf', run: (l) => this.exportXliff(userId, projectId, l, branch) },
      resx: { ext: '.resx', run: (l) => this.exportResx(userId, projectId, l, branch) },
      properties: { ext: '.properties', run: (l) => this.exportProperties(userId, projectId, l, branch) },
      arb: { ext: '.arb', run: (l) => this.exportArb(userId, projectId, l, branch) },
      yaml: { ext: '.yaml', run: (l) => this.exportYaml(userId, projectId, l, branch) },
    };
    const exporter = exporters[format];
    if (!exporter) throw new BadRequestException(`Unknown bundle format ${format}; expected one of ${Object.keys(exporters).join(', ')}`);
    const project = await this.projects.getFor(userId, projectId);
    const locales = project.locales.map((l) => l.code).sort((a, b) => a.localeCompare(b));
    const entries = [] as { name: string; data: Buffer }[];
    for (const locale of locales) {
      entries.push({ name: zipSafeName(locale) + exporter.ext, data: Buffer.from(await exporter.run(locale), 'utf8') });
    }
    let zip: Buffer;
    try {
      zip = buildZip(entries);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('zip size limit')) throw new PayloadTooLargeException(message);
      throw new BadRequestException(`Cannot build bundle: ${message}`);
    }
    return { zip, filename: `${zipSafeName(project.slug)}-${format}.zip` };
  }

  // Import a bundle zip (the export-bundle shape): one entry per locale,
  // every entry in the declared format. Per-locale partial semantics mirror
  // the per-key partial single-file import: each locale imports through the
  // existing per-locale path (same grants, locks, atomicity), entries that
  // name no locale or the wrong extension are skipped with a reason, and a
  // locale whose import is rejected (grant, parse, lock) is reported without
  // aborting the others. Read path: readZip's store-only subset with CRC
  // verification and the shared archive budgets.
  async importBundle(userId: string, projectId: string, format: string, zip: Buffer, branch?: string) {
    const importers: Record<string, { ext: string; run: (locale: string, text: string) => Promise<unknown> }> = {
      json: { ext: '.json', run: (l, t) => this.importJson(userId, projectId, l, JSON.parse(t) as Record<string, unknown>, branch) },
      csv: { ext: '.csv', run: (l, t) => this.importCsv(userId, projectId, l, t, branch) },
      android: { ext: '.xml', run: (l, t) => this.importAndroid(userId, projectId, l, t, branch) },
      ios: { ext: '.strings', run: (l, t) => this.importIos(userId, projectId, l, t, branch) },
      stringsdict: { ext: '.stringsdict', run: (l, t) => this.importStringsdict(userId, projectId, l, t, branch) },
      po: { ext: '.po', run: (l, t) => this.importPo(userId, projectId, l, t, branch) },
      pot: { ext: '.pot', run: (l, t) => this.importPot(userId, projectId, l, t, branch) },
      xliff: { ext: '.xlf', run: (l, t) => this.importXliff(userId, projectId, l, t, branch) },
      resx: { ext: '.resx', run: (l, t) => this.importResx(userId, projectId, l, t, branch) },
      properties: { ext: '.properties', run: (l, t) => this.importProperties(userId, projectId, l, t, branch) },
      arb: { ext: '.arb', run: (l, t) => this.importArb(userId, projectId, l, t, branch) },
      yaml: { ext: '.yaml', run: (l, t) => this.importYaml(userId, projectId, l, t, branch) },
    };
    const importer = importers[format];
    if (!importer) throw new BadRequestException(`Unknown bundle format ${format}; expected one of ${Object.keys(importers).join(', ')}`);
    const project = await this.projects.getFor(userId, projectId);
    let entries;
    try {
      entries = readZip(zip);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : String(err));
    }
    const byStem = new Map<string, string>();
    for (const l of project.locales) {
      byStem.set(l.code, l.code); // exact match wins
    }
    const sanitized = new Map<string, string[]>();
    for (const l of project.locales) {
      const safe = zipSafeName(l.code);
      if (!byStem.has(safe)) sanitized.set(safe, [...(sanitized.get(safe) ?? []), l.code]);
    }
    const imported: Array<{ locale: string } & Record<string, unknown>> = [];
    const skipped: { name: string; reason: string }[] = [];
    const failedLocales: { locale: string; status: number; error: string }[] = [];
    for (const entry of entries) {
      if (entry.name.includes('/')) { skipped.push({ name: entry.name, reason: 'entry is inside a directory; bundle entries are flat' }); continue; }
      if (!entry.name.endsWith(importer.ext)) { skipped.push({ name: entry.name, reason: `expected a ${importer.ext} entry for format ${format}` }); continue; }
      const stem = entry.name.slice(0, -importer.ext.length);
      let locale = byStem.get(stem) ?? null;
      if (!locale) {
        const candidates = sanitized.get(stem) ?? [];
        if (candidates.length === 1) locale = candidates[0];
        else if (candidates.length > 1) { skipped.push({ name: entry.name, reason: `stem matches multiple locales (${candidates.join(', ')})` }); continue; }
      }
      if (!locale) { skipped.push({ name: entry.name, reason: 'no project locale matches the entry name' }); continue; }
      const text = entry.data.toString('utf8');
      if (text.length > 2_000_000) { failedLocales.push({ locale, status: 413, error: 'entry exceeds the 2,000,000 character per-file limit' }); continue; }
      try {
        const res = (await importer.run(locale, text)) as Record<string, unknown>;
        imported.push({ locale, ...res });
      } catch (err) {
        if (err instanceof HttpException) failedLocales.push({ locale, status: err.getStatus(), error: err.message });
        else throw err;
      }
    }
    return { format, branch: branch ?? 'main', imported, skipped, failedLocales };
  }

  // Single parse dispatch for every import format. The write path and the
  // dry-run preview share it, so both see identical parsing and identical
  // 400 rejections, in the same order (parse errors before grant checks).
  private parseImport(dto: ImportJsonDto): { entries: Record<string, unknown>; untranslatedSkipped: number; plurals?: Record<string, Record<string, string>> } {
    if (dto.po != null) {
      const { rows, rejected } = parsePo(dto.po);
      if (rejected > 0) {
        throw new BadRequestException(`${rejected} PO ${rejected === 1 ? 'entry' : 'entries'} rejected: plurals (msgid_plural/msgstr[n]), contexts (msgctxt) and malformed strings are not supported`);
      }
      return { entries: Object.fromEntries(rows), untranslatedSkipped: 0 };
    }
    if (dto.pot != null) {
      const { rows, rejected } = parsePo(dto.pot);
      if (rejected > 0) {
        throw new BadRequestException(`${rejected} POT ${rejected === 1 ? 'entry' : 'entries'} rejected: plurals (msgid_plural/msgstr[n]), contexts (msgctxt) and malformed strings are not supported`);
      }
      return { entries: Object.fromEntries(rows), untranslatedSkipped: 0 };
    }
    if (dto.xliff != null) {
      const { rows, rejected, skipped } = parseXliff(dto.xliff);
      if (rejected > 0) {
        throw new BadRequestException(`${rejected} XLIFF trans-unit(s) rejected: a missing <xliff> root, group nesting, inline markup, alt-trans/seg-source and duplicate or missing ids are not supported`);
      }
      return { entries: Object.fromEntries(rows), untranslatedSkipped: skipped };
    }
    if (dto.resx != null) {
      const { rows, rejected } = parseResx(dto.resx);
      if (rejected > 0) {
        throw new BadRequestException(`${rejected} RESX data row(s) rejected: a missing <root>, metadata/assembly sections, typed or binary resources, inline markup and duplicate or missing names are not supported`);
      }
      return { entries: Object.fromEntries(rows), untranslatedSkipped: 0 };
    }
    if (dto.properties != null) {
      const { rows, rejected } = parseProperties(dto.properties);
      if (rejected > 0) {
        throw new BadRequestException(`${rejected} .properties line(s) rejected: separator-less lines, duplicate keys and malformed escapes are not supported`);
      }
      return { entries: Object.fromEntries(rows), untranslatedSkipped: 0 };
    }
    if (dto.arb != null) {
      const { rows, rejected } = parseArb(dto.arb);
      if (rejected > 0) {
        throw new BadRequestException(`${rejected} ARB ${rejected === 1 ? 'entry' : 'entries'} rejected: non-string or nested values, ICU plural/select messages and malformed JSON are not supported`);
      }
      return { entries: Object.fromEntries(rows), untranslatedSkipped: 0 };
    }
    if (dto.yaml != null) {
      return { entries: this.parseYamlEntries(dto), untranslatedSkipped: 0 };
    }
    if (dto.csv != null) {
      const { rows, rejected } = parseCsv(dto.csv);
      if (rejected > 0) {
        throw new BadRequestException(`${rejected} CSV row(s) have more than 2 columns`);
      }
      return { entries: Object.fromEntries(rows), untranslatedSkipped: 0 };
    }
    if (dto.xml != null) {
      const { rows, plurals, rejected } = parseAndroidXml(dto.xml);
      if (rejected > 0) {
        throw new BadRequestException(`${rejected} unsupported or unparsable element(s) in Android XML: a missing <resources> root, string-array, DOCTYPE/entity declarations, nested markup, and plurals items with a non-CLDR quantity, duplicate quantities or inner markup are not supported`);
      }
      // Plural entries join the entries map with their "other" form as the
      // plain value; the full category map rides separately.
      const pluralRows = plurals.map(([n, f]) => [n, f.other ?? ''] as [string, string]);
      return {
        entries: { ...Object.fromEntries(rows), ...Object.fromEntries(pluralRows) },
        untranslatedSkipped: 0,
        plurals: Object.fromEntries(plurals),
      };
    }
    if (dto.strings != null) {
      const { rows, rejected } = parseIosStrings(dto.strings);
      if (rejected > 0) {
        throw new BadRequestException(`${rejected} line(s) are not valid "key" = "value"; entries`);
      }
      return { entries: Object.fromEntries(rows), untranslatedSkipped: 0 };
    }
    if (dto.stringsdict != null) {
      const { plurals, rejected } = parseStringsdict(dto.stringsdict);
      if (rejected > 0) {
        throw new BadRequestException(`${rejected} .stringsdict ${rejected === 1 ? 'entry' : 'entries'} rejected: a missing <plist> root, non-plural or unknown dict keys, duplicate categories, inner markup, nested dicts and DOCTYPE/entity declarations are not supported`);
      }
      const pluralRows = plurals.map(([n, f]) => [n, f.other ?? ''] as [string, string]);
      return {
        entries: Object.fromEntries(pluralRows),
        untranslatedSkipped: 0,
        plurals: Object.fromEntries(plurals),
      };
    }
    if (dto.entries != null) {
      return { entries: dto.entries, untranslatedSkipped: 0 };
    }
    throw new BadRequestException('Provide entries (JSON), csv, xml, strings, stringsdict, po, xliff, properties, arb, yaml or resx');
  }

  // YAML parsing needs the target locale for its locale-root rule, so it is
  // split out of parseImport (which is locale-agnostic for every other format).
  private parseYamlEntries(dto: ImportJsonDto, locale?: string) {
    const { rows, rejected } = parseYaml(dto.yaml!, locale);
    if (rejected > 0) {
      throw new BadRequestException(`${rejected} YAML ${rejected === 1 ? 'line' : 'lines'} rejected: document markers, lists, flow collections, anchors/aliases/tags, block scalars, bare null keys, duplicates, bad escapes and a root key naming a different locale are not supported`);
    }
    return Object.fromEntries(rows);
  }

  async importAndroid(userId: string, projectId: string, locale: string, xml: string, branch?: string) {
    const parsed = this.parseImport({ xml });
    return this.importJson(userId, projectId, locale, parsed.entries, branch, undefined, parsed.plurals);
  }

  async importIos(userId: string, projectId: string, locale: string, strings: string, branch?: string) {
    return this.importJson(userId, projectId, locale, this.parseImport({ strings }).entries, branch);
  }

  async importStringsdict(userId: string, projectId: string, locale: string, stringsdict: string, branch?: string) {
    const parsed = this.parseImport({ stringsdict });
    return this.importJson(userId, projectId, locale, parsed.entries, branch, undefined, parsed.plurals);
  }

  async importPo(userId: string, projectId: string, locale: string, po: string, branch?: string) {
    return this.importJson(userId, projectId, locale, this.parseImport({ po }).entries, branch);
  }

  async importPot(userId: string, projectId: string, locale: string, pot: string, branch?: string) {
    // POT is a template: blank msgstr entries create keys and fill empty
    // translations, but never overwrite an existing translation.
    return this.importJson(userId, projectId, locale, this.parseImport({ pot }).entries, branch, { preserveOnBlank: true });
  }

  async importXliff(userId: string, projectId: string, locale: string, xliff: string, branch?: string) {
    const { entries, untranslatedSkipped } = this.parseImport({ xliff });
    const res = await this.importJson(userId, projectId, locale, entries, branch);
    return { ...res, untranslatedSkipped };
  }

  async importResx(userId: string, projectId: string, locale: string, resx: string, branch?: string) {
    return this.importJson(userId, projectId, locale, this.parseImport({ resx }).entries, branch);
  }

  async importProperties(userId: string, projectId: string, locale: string, properties: string, branch?: string) {
    return this.importJson(userId, projectId, locale, this.parseImport({ properties }).entries, branch);
  }

  async importArb(userId: string, projectId: string, locale: string, arb: string, branch?: string) {
    return this.importJson(userId, projectId, locale, this.parseImport({ arb }).entries, branch);
  }

  async importYaml(userId: string, projectId: string, locale: string, yaml: string, branch?: string) {
    return this.importJson(userId, projectId, locale, this.parseYamlEntries({ yaml }, locale), branch);
  }

  async importCsv(userId: string, projectId: string, locale: string, csv: string, branch?: string) {
    return this.importJson(userId, projectId, locale, this.parseImport({ csv }).entries, branch);
  }

  // Dry-run preview: the same parsing, grant, locale and lock rules as a real
  // import, but strictly read-only - no snapshot, no ImportRun row, no key or
  // translation writes. Counts are a point-in-time snapshot: a concurrent
  // change between preview and import shifts them.
  async importPreview(userId: string, projectId: string, locale: string, dto: ImportJsonDto, branch?: string) {
    const parsed = dto.yaml != null
      ? { entries: this.parseYamlEntries(dto, locale), untranslatedSkipped: 0 }
      : this.parseImport(dto);
    await this.projects.assertLocaleWrite(userId, projectId, [locale]);
    const b = await this.branches.branchFor(projectId, branch);
    const project = await this.projects.getFor(userId, projectId);
    if (!project.locales.some((l) => l.code === locale)) {
      throw new BadRequestException(`Locale ${locale} is not part of this project`);
    }
    const { flat, rejected } = flattenJson(parsed.entries);
    let keysCreated = 0;
    let translationsUpserted = 0;
    let unchangedSkipped = 0;
    let failed = rejected.length;
    const failures: string[] = rejected.length
      ? [`Non-string values rejected for: ${rejected.slice(0, 5).join(', ')}`]
      : [];
    for (const [name, value] of Object.entries(flat)) {
      const key = await this.prisma.key.findUnique({
        where: { branchId_name: { branchId: b.id, name } },
      });
      if (!key) {
        keysCreated++;
        translationsUpserted++;
        continue;
      }
      const lockTitle = await this.tasks.keyLockFor(this.prisma, userId, projectId, key.id);
      if (lockTitle) {
        failed++;
        if (failures.length < 5) failures.push(`Key "${name}" is locked by task "${lockTitle}"`);
        continue;
      }
      const existing = await this.prisma.translation.findUnique({
        where: { keyId_localeCode: { keyId: key.id, localeCode: locale } },
      });
      if (existing && existing.value === value) unchangedSkipped++;
      else translationsUpserted++;
    }
    const status = failed > 0
      ? (translationsUpserted + unchangedSkipped > 0 ? 'PARTIAL' : 'FAILED')
      : 'COMPLETED';
    return {
      locale, keysCreated, translationsUpserted, unchangedSkipped, failed, status,
      ...(failures.length ? { error: truncate(failures[0]), failures: failures.map((f) => truncate(f)) } : {}),
      ...(parsed.untranslatedSkipped ? { untranslatedSkipped: parsed.untranslatedSkipped } : {}),
      dryRun: true as const,
    };
  }

  async importJson(userId: string, projectId: string, locale: string, entries: Record<string, unknown>, branch?: string, opts?: { preserveOnBlank?: boolean }, plurals?: Record<string, Record<string, string>>) {
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
      this.importJsonLocked(userId, projectId, locale, project.baseLocale, entries, flat, rejected, b.id, opts, plurals));
  }

  private async importJsonLocked(
    userId: string, projectId: string, locale: string, baseLocale: string,
    entries: Record<string, unknown>, flat: Record<string, string>, rejected: string[],
    branchId: string, opts?: { preserveOnBlank?: boolean },
    plurals?: Record<string, Record<string, string>>,
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
          // Atomic create-if-absent: ON CONFLICT DO NOTHING + RETURNING tells
          // us reliably whether THIS statement inserted the key. The previous
          // createdAt === updatedAt heuristic misclassified never-updated
          // existing keys as created (the two timestamps can differ by a
          // millisecond per row), overcounting keysCreated on reimports.
          const inserted = await tx.$queryRaw<{ id: string }[]>`
            INSERT INTO "keys" ("id", "projectId", "branchId", "name", "createdAt", "updatedAt")
            VALUES (${randomUUID()}::uuid, ${projectId}::uuid, ${branchId}::uuid, ${name}, now(), now())
            ON CONFLICT ("branchId", "name") DO NOTHING
            RETURNING "id"`;
          const keyCreated = inserted.length === 1;
          const key = keyCreated
            ? inserted[0]
            : await tx.key.findUniqueOrThrow({ where: { branchId_name: { branchId, name } } });
          // Locked keys fail their own per-key transaction (the run row
          // records the failure); the rest of the import continues.
          await this.tasks.assertKeysEditable(tx, userId, projectId, [key.id]);
          const forms = plurals?.[name];
          if (forms) {
            // Same validation as the single-translation write path.
            let allowed: string[];
            try {
              allowed = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
            } catch {
              throw new BadRequestException(`No CLDR plural rules for locale ${locale}`);
            }
            const invalid = Object.keys(forms).filter((c) => !allowed.includes(c));
            if (invalid.length) {
              throw new BadRequestException(`Locale ${locale} has no plural categories: ${invalid.join(', ')} (allowed: ${allowed.join(', ')})`);
            }
            if (!('other' in forms)) throw new BadRequestException(`plurals import for ${name} requires an "other" item`);
            // Importing a <plurals> upgrades the key to plural metadata
            // (explicit, documented); it never downgrades: a <string> import
            // for a plural key leaves isPlural and stored forms untouched.
            await tx.key.update({ where: { id: key.id }, data: { isPlural: true } });
          }
          const existing = await tx.translation.findUnique({
            where: { keyId_localeCode: { keyId: key.id, localeCode: locale } },
          });
          if (existing && existing.value === value && (!forms || canonPlural(existing.pluralForms) === canonPlural(forms))) {
            await tx.importRun.update({
              where: { id: run.id }, data: { unchangedSkipped: { increment: 1 } },
            });
            return;
          }
          if (opts?.preserveOnBlank && value === '' && existing && existing.value !== '') {
            // Template semantics (POT): a blank template entry must never
            // erase an existing translation. Checked against the row inside
            // the same transaction that would otherwise write, so a
            // concurrent edit cannot be blanked either. Counted as unchanged:
            // nothing changed.
            await tx.importRun.update({
              where: { id: run.id }, data: { unchangedSkipped: { increment: 1 } },
            });
            return;
          }
          // Imported wording replaces the old one and has not been reviewed.
          await tx.translation.upsert({
            where: { keyId_localeCode: { keyId: key.id, localeCode: locale } },
            create: { keyId: key.id, projectId, localeCode: locale, value, version: 1, ...(forms ? { pluralForms: forms } : {}) },
            // A <plurals> import replaces stored forms, same as value (imported
            // wording wins); a <string> import omits the field and preserves them.
            update: { value, status: 'UNVERIFIED', version: { increment: 1 }, ...(forms ? { pluralForms: forms } : {}) },
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
