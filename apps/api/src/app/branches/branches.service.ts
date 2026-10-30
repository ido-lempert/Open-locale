import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ActivityService } from '../activity/activity.service';
import { LocksService } from '../locks/locks.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { TasksService } from '../tasks/tasks.service';

export const DEFAULT_BRANCH = 'main';
const BRANCH_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/;

// Canonical comparison for pluralForms read back from jsonb (key order is
// normalized by PostgreSQL) vs the source row's object.
const canonPlural = (v: unknown): string =>
  v == null ? 'null' : JSON.stringify(Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1))));

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly locks: LocksService,
    private readonly snapshots: SnapshotsService,
    private readonly tasks: TasksService,
  ) {}

  // Resolve a branch by name for a project; default is 'main'. Unknown branch
  // names 404 so typos never silently read or write the wrong branch.
  async branchFor(projectId: string, name?: string | null) {
    const branch = await this.prisma.branch.findUnique({
      where: { projectId_name: { projectId, name: name || DEFAULT_BRANCH } },
    });
    if (!branch) throw new NotFoundException(`Branch '${name || DEFAULT_BRANCH}' not found`);
    return branch;
  }

  async list(userId: string, projectId: string) {
    await this.projects.getFor(userId, projectId);
    return this.prisma.branch.findMany({
      where: { projectId },
      include: { _count: { select: { keys: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, projectId: string, name: string) {
    await this.projects.requireAdmin(userId, projectId);
    if (!BRANCH_NAME.test(name)) {
      throw new BadRequestException('Branch name must be 1-40 chars: letters, digits, dot, dash, underscore; starting with a letter or digit');
    }
    const existing = await this.prisma.branch.findUnique({ where: { projectId_name: { projectId, name } } });
    if (existing) throw new BadRequestException(`Branch '${name}' already exists`);
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({ data: { projectId, name } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'branch.created', detail: { branch: name },
      });
      return branch;
    });
  }

  async remove(userId: string, projectId: string, branchId: string) {
    await this.projects.requireAdmin(userId, projectId);
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, projectId }, include: { _count: { select: { keys: true } } } });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.name === DEFAULT_BRANCH) throw new BadRequestException("The default branch 'main' cannot be deleted");
    return this.locks.withProjectLock(projectId, () => this.prisma.$transaction(async (tx) => {
      await tx.branch.delete({ where: { id: branch.id } }); // cascades its keys
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'branch.deleted',
        detail: { branch: branch.name, keysRemoved: branch._count.keys },
      });
      return { removed: branch.name, keysRemoved: branch._count.keys };
    }));
  }

  // Merge source into target: upsert keys by name and copy their translations
  // (value + status). Target-only keys are kept; nothing is deleted. Admin
  // only, under the project lock like imports and restores.
  private async resolvePair(userId: string, projectId: string, sourceId: string, intoName: string) {
    await this.projects.requireAdmin(userId, projectId);
    const source = await this.prisma.branch.findFirst({ where: { id: sourceId, projectId } });
    if (!source) throw new NotFoundException('Branch not found');
    const target = await this.prisma.branch.findUnique({ where: { projectId_name: { projectId, name: intoName } } });
    if (!target) throw new NotFoundException(`Branch '${intoName}' not found`);
    if (source.id === target.id) throw new BadRequestException('Cannot merge a branch into itself');
    return { source, target };
  }

  // Diff the source branch against the target without writing. Counts are what
  // the merge WOULD do right now: keys only in the source (created), key names
  // on both (metadata copied), translations identical (skipped), new on the
  // target (added), and CONFLICTS where the target translation exists with a
  // different value or status - those overwrite the target on merge, so the UI
  // must show this number. previewAt is DB-server time for the optimistic
  // guard on the executing merge (same pattern as the bulk review preview).
  async previewMerge(userId: string, projectId: string, sourceId: string, intoName: string) {
    const { source, target } = await this.resolvePair(userId, projectId, sourceId, intoName);
    const sourceKeys = await this.prisma.key.findMany({ where: { branchId: source.id }, include: { translations: true } });
    const targetKeys = await this.prisma.key.findMany({ where: { branchId: target.id }, include: { translations: true } });
    const targetByName = new Map(targetKeys.map((k) => [k.name, k]));
    let keysCreated = 0, keysExisting = 0, translationsAdded = 0, translationsOverwritten = 0, translationsIdentical = 0;
    for (const sk of sourceKeys) {
      const tk = targetByName.get(sk.name);
      if (!tk) { keysCreated++; translationsAdded += sk.translations.length; continue; }
      keysExisting++;
      const tByLocale = new Map(tk.translations.map((t) => [t.localeCode, t]));
      for (const tr of sk.translations) {
        const ex = tByLocale.get(tr.localeCode);
        if (!ex) translationsAdded++;
        else if (ex.value === tr.value && ex.status === tr.status && canonPlural(ex.pluralForms) === canonPlural(tr.pluralForms)) translationsIdentical++;
        else translationsOverwritten++;
      }
    }
    const rows = await this.prisma.$queryRaw<{ now: string }[]>(
      Prisma.sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS now`);
    return {
      from: source.name, into: target.name,
      keysCreated, keysExisting, translationsAdded, translationsOverwritten, translationsIdentical,
      targetOnlyKeys: targetKeys.length - keysExisting,
      previewAt: rows[0].now,
    };
  }

  async merge(userId: string, projectId: string, sourceId: string, intoName: string, previewedAt?: string) {
    const { source, target } = await this.resolvePair(userId, projectId, sourceId, intoName);
    if (previewedAt !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(previewedAt)) {
        throw new BadRequestException('previewedAt must be the previewAt value from a merge preview');
      }
    }
    return this.locks.withProjectLock(projectId, async () => {
      // Safety net: the exact pre-merge state must be restorable, same rule as
      // imports. Whole-project capture (snapshots store the branch per key).
      await this.snapshots.captureAutomatic(projectId, `before merge ${source.name} -> ${target.name}`, userId);
      return this.prisma.$transaction(async (tx) => {
        const sourceKeys = await tx.key.findMany({ where: { branchId: source.id }, include: { translations: true } });
        // Optimistic guard: when the client passes previewAt back, anything
        // written to the target AFTER that DB-server instant (concurrent edit,
        // ABA round-trip - updatedAt bumps on every write) is skipped and
        // reported instead of silently overwritten. Conservative: a row that
        // changed and changed back is still skipped.
        const cutoff = previewedAt ?? null;
        let keysMerged = 0, keysSkipped = 0, translationsMerged = 0, translationsSkipped = 0;
        const lockGuarded = new Set<string>();
        for (const sk of sourceKeys) {
          // Atomic check-and-write, never read-then-write: every target write
          // carries its freshness condition in the same statement, so a
          // concurrent commit between our reads and writes is either applied
          // over (unguarded merge) or makes that statement a no-op (guarded
          // merge). updatedAt columns are timestamp-without-tz holding UTC
          // wall time, so the cutoff compares as a naive UTC literal.
          let tkId: string;
          const prior = await tx.key.findUnique({ where: { branchId_name: { branchId: target.id, name: sk.name } } });
          if (prior) {
            if (cutoff !== null) {
              const wrote = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
                UPDATE "keys" SET "description" = ${sk.description}, "isPlural" = ${sk.isPlural},
                  "maxLength" = ${sk.maxLength}, "tags" = ${sk.tags}, "updatedAt" = now() AT TIME ZONE 'UTC'
                WHERE "id" = ${prior.id}::uuid AND "updatedAt" <= ${cutoff}::timestamp RETURNING "id"`);
              if (wrote.length === 0) keysSkipped++;
            } else {
              await tx.key.update({
                where: { id: prior.id },
                data: { description: sk.description, isPlural: sk.isPlural, maxLength: sk.maxLength, tags: sk.tags },
              });
            }
            tkId = prior.id;
          } else {
            try {
              const created = await tx.key.create({
                data: {
                  projectId, branchId: target.id, name: sk.name,
                  description: sk.description, isPlural: sk.isPlural, maxLength: sk.maxLength, tags: sk.tags,
                },
              });
              tkId = created.id;
            } catch (err) {
              // A concurrent commit created the same-named key on the target
              // between our read and this insert: treat as a conflict, keep
              // the concurrent row, and skip it rather than fail the merge.
              if ((err as { code?: string }).code !== 'P2002') throw err;
              keysSkipped++;
              tkId = (await tx.key.findUniqueOrThrow({ where: { branchId_name: { branchId: target.id, name: sk.name } } })).id;
              continue;
            }
          }
          if (tkId !== sk.id) keysMerged++;
          for (const tr of sk.translations) {
            // SELECT ... FOR UPDATE locks the latest committed row version
            // (blocking until any in-flight concurrent writer commits or
            // rolls back), so `existing.value` below is EXACTLY the value the
            // merge's conditional write then replaces - not a stale pre-read.
            const existingRows = await tx.$queryRaw<{ value: string; status: string; updatedAt: Date; pluralForms: unknown }[]>(Prisma.sql`
              SELECT "value", "status", "updatedAt", "pluralForms" FROM "translations"
              WHERE "keyId" = ${tkId}::uuid AND "localeCode" = ${tr.localeCode} FOR UPDATE`);
            const existing = existingRows[0] ?? null;
            if (existing && existing.value === tr.value && existing.status === tr.status && canonPlural(existing.pluralForms) === canonPlural(tr.pluralForms)) continue;
            // Task key locks apply to merge writes. Guarded at the first
            // actual write per key (after the no-op skip above), inside this
            // transaction: a denial rolls the whole merge back atomically.
            if (!lockGuarded.has(tkId)) {
              await this.tasks.assertKeysEditable(tx, userId, projectId, [tkId]);
              lockGuarded.add(tkId);
            }
            // INSERT ... ON CONFLICT ... DO UPDATE ... WHERE is one atomic
            // statement: the conflict target row is locked while the freshness
            // WHERE is evaluated, so a concurrent post-preview edit makes THIS
            // statement skip the row instead of being overwritten silently.
            const wrote = cutoff !== null
              ? await tx.$queryRaw<{ keyId: string }[]>(Prisma.sql`
                  INSERT INTO "translations" ("keyId", "projectId", "localeCode", "value", "status", "version", "pluralForms", "updatedAt", "mtScore", "mtProvider")
                  VALUES (${tkId}::uuid, ${projectId}::uuid, ${tr.localeCode}, ${tr.value}, ${tr.status}, 1, ${tr.pluralForms == null ? null : JSON.stringify(tr.pluralForms)}::jsonb, now() AT TIME ZONE 'UTC', ${tr.mtScore}, ${tr.mtProvider})
                  ON CONFLICT ("keyId", "localeCode") DO UPDATE
                  SET "value" = EXCLUDED."value", "status" = EXCLUDED."status", "version" = "translations"."version" + 1, "pluralForms" = EXCLUDED."pluralForms", "updatedAt" = now() AT TIME ZONE 'UTC', "mtScore" = EXCLUDED."mtScore", "mtProvider" = EXCLUDED."mtProvider"
                  WHERE "translations"."updatedAt" <= ${cutoff}::timestamp
                  RETURNING "keyId"`)
              : await tx.$queryRaw<{ keyId: string }[]>(Prisma.sql`
                  INSERT INTO "translations" ("keyId", "projectId", "localeCode", "value", "status", "version", "pluralForms", "updatedAt", "mtScore", "mtProvider")
                  VALUES (${tkId}::uuid, ${projectId}::uuid, ${tr.localeCode}, ${tr.value}, ${tr.status}, 1, ${tr.pluralForms == null ? null : JSON.stringify(tr.pluralForms)}::jsonb, now() AT TIME ZONE 'UTC', ${tr.mtScore}, ${tr.mtProvider})
                  ON CONFLICT ("keyId", "localeCode") DO UPDATE
                  SET "value" = EXCLUDED."value", "status" = EXCLUDED."status", "version" = "translations"."version" + 1, "pluralForms" = EXCLUDED."pluralForms", "updatedAt" = now() AT TIME ZONE 'UTC', "mtScore" = EXCLUDED."mtScore", "mtProvider" = EXCLUDED."mtProvider"
                  RETURNING "keyId"`);
            if (wrote.length === 0) { translationsSkipped++; continue; }
            // Attribution: every overwrite or merge-created translation gets a
            // history row whose previousValue is the exact value read under
            // the FOR UPDATE row lock above - the value this write actually
            // replaced - plus the merging user.
            await tx.translationHistory.create({
              data: {
                keyId: tkId, localeCode: tr.localeCode, value: tr.value,
                previousValue: existing ? existing.value : null,
                status: tr.status, changedById: userId,
              },
            });
            translationsMerged++;
          }
        }
        await this.activity.record(tx, {
          projectId, actorId: userId, action: 'branch.merged',
          detail: { from: source.name, into: target.name, keysMerged, translationsMerged, keysSkipped, translationsSkipped },
        });
        return { merged: `${source.name} -> ${target.name}`, keysMerged, translationsMerged, keysSkipped, translationsSkipped };
      });
    });
  }
}
