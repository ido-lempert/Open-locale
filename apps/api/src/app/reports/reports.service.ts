import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { BranchesService, DEFAULT_BRANCH } from '../branches/branches.service';
import { QaService } from '../qa/qa.service';

// Translation progress per locale for one branch. A key counts as translated
// in a locale when its translation row has a non-empty value; untranslated is
// everything else (missing row or empty string). Status counts cover
// non-empty rows only, so the numbers add up:
// total = untranslated + sum(byStatus), percent = translated / total.
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly branches: BranchesService,
    private readonly qa: QaService,
  ) {}

  async progress(userId: string, projectId: string, branchName?: string) {
    const project = await this.projects.getFor(userId, projectId);
    const branch = await this.branches.branchFor(projectId, branchName ?? DEFAULT_BRANCH);
    const total = await this.prisma.key.count({ where: { branchId: branch.id } });
    const rows = await this.prisma.$queryRaw<{ localeCode: string; status: string; count: bigint }[]>(Prisma.sql`
      SELECT t."localeCode", t."status", count(*) AS count
      FROM "translations" t
      JOIN "keys" k ON k."id" = t."keyId"
      WHERE k."branchId" = ${branch.id}::uuid AND t."value" <> ''
      GROUP BY t."localeCode", t."status"`);
    const byLocale = new Map<string, Map<string, number>>();
    for (const r of rows) {
      if (!byLocale.has(r.localeCode)) byLocale.set(r.localeCode, new Map());
      byLocale.get(r.localeCode)!.set(r.status, Number(r.count));
    }
    const statuses = Array.from(new Set([...project.customStatuses, 'UNVERIFIED', 'TRANSLATED', 'REVIEWED']));
    const locales = project.locales.map((l) => {
      const m = byLocale.get(l.code) ?? new Map<string, number>();
      const byStatus: Record<string, number> = {};
      let translated = 0;
      for (const s of statuses) {
        byStatus[s] = m.get(s) ?? 0;
        translated += byStatus[s];
      }
      // Statuses removed from the project but still on rows: keep the numbers honest.
      for (const [s, n] of m) {
        if (!(s in byStatus)) { byStatus[s] = n; translated += n; }
      }
      return {
        locale: l.code, base: l.code === project.baseLocale,
        total, translated, untranslated: total - translated,
        percent: total === 0 ? 0 : Math.round((translated / total) * 100),
        byStatus,
      };
    });
    return { branch: branch.name, totalKeys: total, locales };
  }

  // Quality dashboard: runs the same QA engine as GET /qa (no duplicated
  // check semantics) and aggregates findings by type and locale.
  async quality(userId: string, projectId: string, branchName?: string) {
    const { issues } = await this.qa.run(userId, projectId, undefined, branchName ?? DEFAULT_BRANCH);
    const byType: Record<string, number> = {};
    const localeMap = new Map<string, Record<string, number>>();
    const keysWithIssues = new Set<string>();
    for (const i of issues) {
      byType[i.type] = (byType[i.type] ?? 0) + 1;
      if (!localeMap.has(i.locale)) localeMap.set(i.locale, {});
      const m = localeMap.get(i.locale)!;
      m[i.type] = (m[i.type] ?? 0) + 1;
      keysWithIssues.add(i.keyId);
    }
    const types = Object.keys(byType).sort();
    const locales = [...localeMap.keys()].sort().map((code) => {
      const m = localeMap.get(code)!;
      let total = 0;
      for (const t of types) total += m[t] ?? 0;
      return { locale: code, total, byType: m };
    });
    return { branch: branchName ?? DEFAULT_BRANCH, totalIssues: issues.length, keysWithIssues: keysWithIssues.size, types, byType, locales };
  }

  // Usage dashboard: activity volume over a trailing window (default 30
  // days, capped 1-90) - totals by action, by day, top actors, active keys.
  async usage(userId: string, projectId: string, daysRaw?: number) {
    await this.projects.getFor(userId, projectId);
    const days = Math.min(Math.max(daysRaw || 30, 1), 90);
    const since = new Date(Date.now() - days * 86400_000);
    const byAction = await this.prisma.activityEvent.groupBy({
      by: ['action'], where: { projectId, createdAt: { gte: since } }, _count: { _all: true },
    });
    const dayRows = await this.prisma.$queryRaw<{ day: Date; count: bigint }[]>(Prisma.sql`
      SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
      FROM "activity_events"
      WHERE "projectId" = ${projectId}::uuid AND "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`);
    const actorRows = await this.prisma.activityEvent.groupBy({
      by: ['actorId'], where: { projectId, createdAt: { gte: since }, actorId: { not: null } },
      _count: { _all: true }, orderBy: { _count: { actorId: 'desc' } }, take: 5,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: actorRows.map((a) => a.actorId!) } },
      select: { id: true, displayName: true, email: true },
    });
    const nameOf = new Map(users.map((u) => [u.id, u.displayName]));
    const keyRows = await this.prisma.activityEvent.findMany({
      where: { projectId, createdAt: { gte: since }, keyName: { not: null } },
      select: { keyName: true }, distinct: ['keyName'],
    });
    const totalEvents = byAction.reduce((n, a) => n + a._count._all, 0);
    return {
      days, since, totalEvents, activeKeys: keyRows.length,
      byAction: Object.fromEntries(byAction.map((a) => [a.action, a._count._all])),
      byDay: dayRows.map((r) => ({ day: r.day.toISOString().slice(0, 10), count: Number(r.count) })),
      topActors: actorRows.map((a) => ({ name: nameOf.get(a.actorId!) ?? 'former member', count: a._count._all })),
    };
  }

  // Task dashboard: workload shape - status totals, overdue and due-soon
  // counts, and open work per assignee (unassigned listed as its own row).
  async tasks(userId: string, projectId: string) {
    await this.projects.getFor(userId, projectId);
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400_000);
    const byStatusRows = await this.prisma.task.groupBy({
      by: ['status'], where: { projectId }, _count: { _all: true },
    });
    const byStatus: Record<string, number> = { OPEN: 0, IN_PROGRESS: 0, DONE: 0 };
    for (const r of byStatusRows) byStatus[r.status] = r._count._all;
    const overdue = await this.prisma.task.count({
      where: { projectId, status: { not: 'DONE' }, dueDate: { lt: now } },
    });
    const dueSoon = await this.prisma.task.count({
      where: { projectId, status: { not: 'DONE' }, dueDate: { gte: now, lte: in7 } },
    });
    const openRows = await this.prisma.task.findMany({
      where: { projectId, status: { not: 'DONE' } },
      select: { assigneeId: true, assignee: { select: { displayName: true } } },
    });
    const perAssignee = new Map<string, number>();
    for (const t of openRows) {
      const name = t.assignee?.displayName ?? 'unassigned';
      perAssignee.set(name, (perAssignee.get(name) ?? 0) + 1);
    }
    const total = byStatus.OPEN + byStatus.IN_PROGRESS + byStatus.DONE;
    return {
      total, byStatus, overdue, dueSoon,
      perAssignee: [...perAssignee.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    };
  }
}
