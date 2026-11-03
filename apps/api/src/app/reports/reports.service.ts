import { BadRequestException, Injectable } from '@nestjs/common';
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
    // Key denominator and filled status groups share one statement snapshot.
    // Project/locales and branch resolution above are still separate reads.
    const rows = await this.prisma.$queryRaw<{ total:bigint; localeCode:string|null; status:string|null; count:bigint|null }[]>(Prisma.sql`
      WITH scoped_keys AS (SELECT id FROM "keys" WHERE "branchId" = ${branch.id}::uuid),
      totals AS (SELECT count(*) AS total FROM scoped_keys),
      filled AS (
        SELECT t."localeCode", t."status", count(*) AS count
        FROM "translations" t JOIN scoped_keys k ON k.id = t."keyId"
        WHERE t."value" <> '' GROUP BY t."localeCode", t."status"
      )
      SELECT totals.total, filled."localeCode", filled."status", filled.count
      FROM totals LEFT JOIN filled ON true`);
    const total=Number(rows[0].total);
    const byLocale = new Map<string, Map<string, number>>();
    for (const r of rows) {
      if(r.localeCode===null||r.status===null)continue;
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
    if(daysRaw!==undefined&&!Number.isSafeInteger(daysRaw))throw new BadRequestException('Usage days must be a finite safe integer');
    const days = Math.min(Math.max(daysRaw ?? 30, 1), 90);
    const asOf=new Date();
    const since = new Date(asOf.getTime() - days * 86400_000);
    const byAction = await this.prisma.activityEvent.groupBy({
      by: ['action'], where: { projectId, createdAt: { gte: since, lte:asOf } }, _count: { _all: true },
    });
    const dayRows = await this.prisma.$queryRaw<{ day: string; count: bigint }[]>(Prisma.sql`
      SELECT to_char("createdAt" AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, count(*) AS count
      FROM "activity_events"
      WHERE "projectId" = ${projectId}::uuid AND "createdAt" >= ${since} AND "createdAt" <= ${asOf}
      GROUP BY 1 ORDER BY 1`);
    const actorRows = await this.prisma.activityEvent.groupBy({
      by: ['actorId'], where: { projectId, createdAt: { gte: since, lte:asOf }, actorId: { not: null } },
      _count: { _all: true }, orderBy: [{ _count: { actorId: 'desc' } },{actorId:'asc'}], take: 5,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: actorRows.map((a) => a.actorId!) } },
      select: { id: true, displayName: true, email: true },
    });
    const nameOf = new Map(users.map((u) => [u.id, u.displayName]));
    // Count in PostgreSQL rather than materializing every distinct key name in
    // the API process. This preserves activity-name semantics (not live key IDs).
    const [keyCount] = await this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count(DISTINCT "keyName") AS count FROM "activity_events"
      WHERE "projectId" = ${projectId}::uuid AND "createdAt" >= ${since} AND "createdAt" <= ${asOf}`);
    const totalEvents = byAction.reduce((n, a) => n + a._count._all, 0);
    return {
      days, since, asOf, timezone:'UTC' as const, totalEvents, activeKeys: Number(keyCount.count),
      byAction: Object.fromEntries(byAction.map((a) => [a.action, a._count._all])),
      byDay: dayRows.map((r) => ({ day: r.day, count: Number(r.count) })),
      topActors: actorRows.map((a) => ({ actorId:a.actorId!, name: nameOf.get(a.actorId!) ?? 'former member', count: a._count._all })),
    };
  }

  // Task dashboard: workload shape - status totals, overdue and due-soon
  // counts, and open work per assignee (unassigned listed as its own row).
  async tasks(userId: string, projectId: string) {
    await this.projects.getFor(userId, projectId);
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400_000);
    // Status and date counts share one statement snapshot and one captured
    // clock. Assignment workload below remains a separate statement.
    const [summary] = await this.prisma.$queryRaw<{ open:bigint; inProgress:bigint; done:bigint; overdue:bigint; dueSoon:bigint }[]>(Prisma.sql`
      SELECT count(*) FILTER (WHERE "status" = 'OPEN') AS open,
        count(*) FILTER (WHERE "status" = 'IN_PROGRESS') AS "inProgress",
        count(*) FILTER (WHERE "status" = 'DONE') AS done,
        count(*) FILTER (WHERE "status" <> 'DONE' AND "dueDate" < ${now}) AS overdue,
        count(*) FILTER (WHERE "status" <> 'DONE' AND "dueDate" >= ${now} AND "dueDate" <= ${in7}) AS "dueSoon"
      FROM "tasks" WHERE "projectId" = ${projectId}::uuid`);
    const byStatus: Record<string,number> = {OPEN:Number(summary.open),IN_PROGRESS:Number(summary.inProgress),DONE:Number(summary.done)};
    const overdue=Number(summary.overdue),dueSoon=Number(summary.dueSoon);
    // Normalize privileged invalid dual assignments before grouping: the user
    // wins, matching task workload semantics without materializing task rows.
    const openRows = await this.prisma.$queryRaw<{ assigneeId:string|null; assigneeGroupId:string|null; name:string; count:bigint }[]>(Prisma.sql`
      SELECT grouped."assigneeId", grouped."assigneeGroupId",
        CASE WHEN grouped."assigneeId" IS NOT NULL THEN COALESCE(u."displayName",'former member')
             WHEN grouped."assigneeGroupId" IS NOT NULL THEN COALESCE(g."name",'former group')
             ELSE 'unassigned' END AS name, grouped.count
      FROM (
        SELECT "assigneeId", CASE WHEN "assigneeId" IS NULL THEN "assigneeGroupId" ELSE NULL END AS "assigneeGroupId", count(*) AS count
        FROM "tasks" WHERE "projectId" = ${projectId}::uuid AND "status" <> 'DONE'
        GROUP BY "assigneeId", CASE WHEN "assigneeId" IS NULL THEN "assigneeGroupId" ELSE NULL END
      ) grouped
      LEFT JOIN "users" u ON u.id = grouped."assigneeId"
      LEFT JOIN "groups" g ON g.id = grouped."assigneeGroupId"`);
    const perAssignee = openRows.map(t=>({
      kind:t.assigneeId?'user' as const:t.assigneeGroupId?'group' as const:'unassigned' as const,
      assigneeId:t.assigneeId,assigneeGroupId:t.assigneeGroupId,name:t.name,count:Number(t.count),
    }));
    const total = byStatus.OPEN + byStatus.IN_PROGRESS + byStatus.DONE;
    return {
      total, byStatus, overdue, dueSoon,
      perAssignee: perAssignee.sort((a,b)=>b.count-a.count||(a.kind+':'+(a.assigneeId??a.assigneeGroupId??'')).localeCompare(b.kind+':'+(b.assigneeId??b.assigneeGroupId??''))),
    };
  }
}
