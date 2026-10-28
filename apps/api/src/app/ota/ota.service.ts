import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ActivityService } from '../activity/activity.service';
import { BranchesService } from '../branches/branches.service';
import { DEFAULT_BRANCH } from '../branches/branches.service';

// Retained publications per (project, branch): bundles duplicate project
// content, so keep the useful recent window (same rule as auto snapshots).
const OTA_KEEP = 25;

// OTA publications: immutable per-branch translation bundles for OTA pull.
// Publish is a release action (admin, session only). Pull is authenticated -
// project members and read-scope API tokens - NEVER public: there is no
// unauthenticated route to any bundle.
@Injectable()
export class OtaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly branches: BranchesService,
  ) {}

  private meta(r: { id: string; version: number; createdAt: Date; payload: unknown; branch: { name: string } }) {
    const payload = r.payload as Record<string, Record<string, string>>;
    return {
      id: r.id, version: r.version, branch: r.branch.name, createdAt: r.createdAt,
      locales: Object.keys(payload).sort(),
      translations: Object.values(payload).reduce((n, m) => n + Object.keys(m).length, 0),
    };
  }

  async publish(userId: string, projectId: string, branchName?: string) {
    await this.projects.requireAdmin(userId, projectId);
    const branch = await this.branches.branchFor(projectId, branchName ?? DEFAULT_BRANCH);
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.otaPublication.findFirst({
        where: { projectId, branchId: branch.id }, orderBy: { version: 'desc' }, select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;
      const keys = await tx.key.findMany({ where: { branchId: branch.id }, include: { translations: true } });
      const payload: Record<string, Record<string, string>> = {};
      for (const k of keys) {
        for (const t of k.translations) {
          (payload[t.localeCode] ??= {})[k.name] = t.value;
        }
      }
      const row = await tx.otaPublication.create({
        data: {
          projectId, branchId: branch.id, version,
          payload: payload as unknown as Prisma.InputJsonValue, createdById: userId,
        },
        include: { branch: { select: { name: true } } },
      });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'ota.published',
        detail: { branch: branch.name, version, locales: Object.keys(payload).length },
      });
      const stale = await tx.otaPublication.findMany({
        where: { projectId, branchId: branch.id }, orderBy: { version: 'desc' }, skip: OTA_KEEP, select: { id: true },
      });
      if (stale.length) await tx.otaPublication.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
      return this.meta(row);
    });
  }

  async list(userId: string, projectId: string) {
    await this.projects.getFor(userId, projectId);
    const rows = await this.prisma.otaPublication.findMany({
      where: { projectId }, orderBy: [{ branchId: 'asc' }, { version: 'desc' }],
      include: { branch: { select: { name: true } } },
    });
    return rows.map((r) => this.meta(r));
  }

  // Returns the bundle plus its caching validators. Callers translate a null
  // row into 404 and handle If-None-Match against etag.
  async bundle(userId: string, projectId: string, opts: { branch?: string; locale: string; version?: number }) {
    await this.projects.getFor(userId, projectId);
    const project = await this.projects.getFor(userId, projectId);
    if (!project.locales.some((l) => l.code === opts.locale)) {
      throw new NotFoundException(`Locale ${opts.locale} is not part of this project`);
    }
    const branch = await this.branches.branchFor(projectId, opts.branch ?? DEFAULT_BRANCH);
    const row = opts.version !== undefined
      ? await this.prisma.otaPublication.findUnique({
          where: { projectId_branchId_version: { projectId, branchId: branch.id, version: opts.version } },
          include: { branch: { select: { name: true } } },
        })
      : await this.prisma.otaPublication.findFirst({
          where: { projectId, branchId: branch.id }, orderBy: { version: 'desc' },
          include: { branch: { select: { name: true } } },
        });
    if (!row) throw new NotFoundException('No OTA publication for this branch yet');
    const payload = row.payload as Record<string, Record<string, string>>;
    return {
      etag: `W/"v${row.version}-${opts.locale}"`,
      body: {
        project: project.slug, branch: row.branch.name, locale: opts.locale,
        version: row.version, publishedAt: row.createdAt,
        translations: payload[opts.locale] ?? {},
      },
    };
  }
}
