import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ActivityService } from '../activity/activity.service';
import { LocksService } from '../locks/locks.service';
import { SnapshotsService } from '../snapshots/snapshots.service';

export const DEFAULT_BRANCH = 'main';
const BRANCH_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/;

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly locks: LocksService,
    private readonly snapshots: SnapshotsService,
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
    return this.prisma.$transaction(async (tx) => {
      await tx.branch.delete({ where: { id: branch.id } }); // cascades its keys
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'branch.deleted',
        detail: { branch: branch.name, keysRemoved: branch._count.keys },
      });
      return { removed: branch.name, keysRemoved: branch._count.keys };
    });
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
        else if (ex.value === tr.value && ex.status === tr.status) translationsIdentical++;
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
        const cutoff = previewedAt ? new Date(previewedAt + 'Z') : null;
        let keysMerged = 0, keysSkipped = 0, translationsMerged = 0, translationsSkipped = 0;
        for (const sk of sourceKeys) {
          // Read the target key BEFORE writing: an upsert's own update bumps
          // updatedAt, so staleness must be judged on the pre-merge row.
          const prior = await tx.key.findUnique({ where: { branchId_name: { branchId: target.id, name: sk.name } } });
          const keyStale = cutoff !== null && prior !== null && prior.updatedAt > cutoff;
          if (keyStale) keysSkipped++;
          const tk = prior
            ? (keyStale
                ? prior
                : await tx.key.update({
                    where: { id: prior.id },
                    data: { description: sk.description, isPlural: sk.isPlural, maxLength: sk.maxLength, tags: sk.tags },
                  }))
            : await tx.key.create({
                data: {
                  projectId, branchId: target.id, name: sk.name,
                  description: sk.description, isPlural: sk.isPlural, maxLength: sk.maxLength, tags: sk.tags,
                },
              });
          if (tk.id !== sk.id) keysMerged++;
          for (const tr of sk.translations) {
            const existing = await tx.translation.findUnique({ where: { keyId_localeCode: { keyId: tk.id, localeCode: tr.localeCode } } });
            if (existing && existing.value === tr.value && existing.status === tr.status) continue;
            if (cutoff !== null && existing && existing.updatedAt > cutoff) {
              translationsSkipped++;
              continue;
            }
            await tx.translation.upsert({
              where: { keyId_localeCode: { keyId: tk.id, localeCode: tr.localeCode } },
              create: {
                keyId: tk.id, projectId, localeCode: tr.localeCode, value: tr.value, status: tr.status,
              },
              update: { value: tr.value, status: tr.status },
            });
            // Attribution: every overwrite or merge-created translation gets a
            // history row with the previous value and the merging user, so the
            // merge is visible (and the old value recoverable) in key history.
            await tx.translationHistory.create({
              data: {
                keyId: tk.id, localeCode: tr.localeCode, value: tr.value,
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
