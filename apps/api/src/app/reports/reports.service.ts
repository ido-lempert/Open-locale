import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { BranchesService, DEFAULT_BRANCH } from '../branches/branches.service';

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
}
