import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ActivityService } from '../activity/activity.service';
import { WebhooksService } from '../webhooks/webhooks.service';

interface SnapshotKey {
  name: string;
  description: string;
  isPlural: boolean;
  maxLength: number | null;
  tags: string[];
}
interface SnapshotTranslation {
  keyName: string;
  localeCode: string;
  value: string;
  status: string;
}

// Cap on retained automatic snapshots per project: imports happen often and
// each snapshot duplicates the project content, so keep the useful recent
// window and prune the rest. Manual snapshots are never auto-pruned.
const AUTO_SNAPSHOT_KEEP = 25;

@Injectable()
export class SnapshotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly webhooks: WebhooksService,
  ) {}

  private async capture(projectId: string, label: string, automatic: boolean, actorId: string | null) {
    const keys = await this.prisma.key.findMany({
      where: { projectId },
      include: { translations: true },
      orderBy: { name: 'asc' },
    });
    const snapKeys: SnapshotKey[] = keys.map((k) => ({
      name: k.name, description: k.description, isPlural: k.isPlural,
      maxLength: k.maxLength, tags: k.tags,
    }));
    const snapTranslations: SnapshotTranslation[] = keys.flatMap((k) =>
      k.translations.map((t) => ({
        keyName: k.name, localeCode: t.localeCode, value: t.value, status: t.status,
      })));
    return this.prisma.snapshot.create({
      data: {
        projectId, label, automatic,
        keys: snapKeys as unknown as Prisma.InputJsonValue,
        translations: snapTranslations as unknown as Prisma.InputJsonValue,
        createdById: actorId,
      },
    });
  }

  async create(userId: string, projectId: string, label: string) {
    await this.projects.getFor(userId, projectId);
    const snapshot = await this.prisma.$transaction(async (tx) => {
      const snap = await this.capture(projectId, label, false, userId);
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'snapshot.created',
        detail: { snapshotId: snap.id, label },
      });
      return snap;
    });
    return this.meta(snapshot);
  }

  // Called by the import path BEFORE any mutation: the pre-import state must
  // always be recoverable, exactly as the plan's "restorable auto snapshots".
  async captureAutomatic(projectId: string, label: string, actorId: string | null) {
    const snap = await this.capture(projectId, label, true, actorId);
    const stale = await this.prisma.snapshot.findMany({
      where: { projectId, automatic: true },
      orderBy: { createdAt: 'desc' },
      skip: AUTO_SNAPSHOT_KEEP,
      select: { id: true },
    });
    if (stale.length) {
      await this.prisma.snapshot.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    }
    return snap;
  }

  async list(userId: string, projectId: string) {
    await this.projects.getFor(userId, projectId);
    const rows = await this.prisma.snapshot.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.meta(r));
  }

  private meta(r: { id: string; label: string; automatic: boolean; createdAt: Date; keys: unknown; translations: unknown }) {
    return {
      id: r.id, label: r.label, automatic: r.automatic, createdAt: r.createdAt,
      keyCount: (r.keys as unknown[]).length,
      translationCount: (r.translations as unknown[]).length,
    };
  }

  // Point-in-time recovery: after restore, the project's keys and translations
  // match the snapshot exactly - keys absent from it are removed, everything
  // else is upserted. One transaction: a crash never leaves a half-restored
  // project, and the audit event commits with the data.
  async restore(userId: string, projectId: string, snapshotId: string) {
    await this.projects.getFor(userId, projectId);
    const snapshot = await this.prisma.snapshot.findFirst({ where: { id: snapshotId, projectId } });
    if (!snapshot) throw new NotFoundException('Snapshot not found');
    const snapKeys = snapshot.keys as unknown as SnapshotKey[];
    const snapTranslations = snapshot.translations as unknown as SnapshotTranslation[];
    const keepNames = new Set(snapKeys.map((k) => k.name));

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.key.findMany({ where: { projectId }, include: { translations: true } });
      const byName = new Map(existing.map((k) => [k.name, k]));
      let keysRemoved = 0;
      let valuesChanged = 0;

      for (const key of existing) {
        if (!keepNames.has(key.name)) {
          await tx.key.delete({ where: { id: key.id } });
          keysRemoved += 1;
        }
      }
      for (const sk of snapKeys) {
        await tx.key.upsert({
          where: { projectId_name: { projectId, name: sk.name } },
          create: { projectId, name: sk.name, description: sk.description, isPlural: sk.isPlural, maxLength: sk.maxLength, tags: sk.tags },
          update: { description: sk.description, isPlural: sk.isPlural, maxLength: sk.maxLength, tags: sk.tags },
        });
      }
      // Re-read ids: upserts above may have created the keys we translate now.
      const current = await tx.key.findMany({ where: { projectId } });
      const idByName = new Map(current.map((k) => [k.name, k.id]));
      for (const st of snapTranslations) {
        const keyId = idByName.get(st.keyName);
        if (!keyId) continue; // translation for a key not in the snapshot: ignore defensively
        const before = byName.get(st.keyName)?.translations.find((t) => t.localeCode === st.localeCode);
        if (before && before.value === st.value && before.status === st.status) continue;
        await tx.translation.upsert({
          where: { keyId_localeCode: { keyId, localeCode: st.localeCode } },
          create: { keyId, projectId, localeCode: st.localeCode, value: st.value, status: st.status as never },
          update: { value: st.value, status: st.status as never },
        });
        await tx.translationHistory.create({
          data: {
            keyId, localeCode: st.localeCode, value: st.value,
            previousValue: before?.value ?? null,
            status: st.status as never, changedById: userId,
          },
        });
        valuesChanged += 1;
      }
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'snapshot.restored',
        detail: { snapshotId, label: snapshot.label, keysRemoved, valuesChanged },
      });
      return { restored: true, snapshotId, keysRemoved, valuesChanged, keyCount: snapKeys.length };
    });
    // Fire-and-forget AFTER commit: webhook listeners see only committed state,
    // and a delivery failure can never roll back the restore.
    void this.webhooks.deliver(projectId, 'project.restored', {
      snapshotId, keysRemoved: result.keysRemoved, valuesChanged: result.valuesChanged,
    });
    return result;
  }
}
