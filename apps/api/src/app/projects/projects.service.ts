import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService, truncate } from '../activity/activity.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  private async teamIdsFor(userId: string): Promise<string[]> {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    return memberships.map((m) => m.teamId);
  }

  async listFor(userId: string) {
    const teamIds = await this.teamIdsFor(userId);
    return this.prisma.project.findMany({
      where: { teamId: { in: teamIds } },
      include: { locales: true, _count: { select: { keys: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFor(userId: string, input: {
    name: string; slug: string; description?: string; baseLocale?: string; locales: string[];
  }) {
    const teamIds = await this.teamIdsFor(userId);
    if (teamIds.length === 0) throw new ForbiddenException('No team membership');
    const baseLocale = input.baseLocale ?? 'en';
    const locales = Array.from(new Set([baseLocale, ...input.locales]));
    return this.prisma.project.create({
      data: {
        teamId: teamIds[0],
        name: input.name,
        slug: input.slug,
        description: input.description ?? '',
        baseLocale,
        locales: { create: locales.map((code) => ({ code })) },
        branches: { create: { name: 'main' } },
      },
      include: { locales: true, branches: true },
    });
  }

  async getFor(userId: string, projectId: string) {
    const teamIds = await this.teamIdsFor(userId);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId: { in: teamIds } },
      include: { locales: true, _count: { select: { keys: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private validateEmbedOrigins(raw: string[]): string[] {
    const origins = Array.from(new Set(raw.map((o) => o.trim())));
    for (const o of origins) {
      let url: URL;
      try {
        url = new URL(o);
      } catch {
        throw new BadRequestException(`Embed origin '${o}' is not a valid URL`);
      }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new BadRequestException(`Embed origin '${o}' must use http or https`);
      }
      // Origin only: no path, query, hash, credentials, or trailing slash.
      if (url.origin !== o) {
        throw new BadRequestException(`Embed origin '${o}' must be a bare origin like https://app.example.com (no path, query or trailing slash)`);
      }
    }
    return origins;
  }

  async updateFor(userId: string, projectId: string, input: { name?: string; description?: string; customStatuses?: string[]; embedOrigins?: string[] }) {
    await this.requireAdmin(userId, projectId);
    const before = await this.getFor(userId, projectId);
    let customStatuses: string[] | undefined;
    if (input.customStatuses !== undefined) {
      const base = ['UNVERIFIED', 'TRANSLATED', 'REVIEWED'];
      customStatuses = Array.from(new Set(input.customStatuses));
      for (const s of customStatuses) {
        if (!/^[A-Z][A-Z0-9_]{1,23}$/.test(s)) {
          throw new BadRequestException(`Custom status '${s}' must be 2-24 chars of A-Z, 0-9, _ and start with a letter`);
        }
        if (base.includes(s)) throw new BadRequestException(`'${s}' is a base status and is always available`);
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id: projectId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(customStatuses !== undefined ? { customStatuses } : {}),
          ...(input.embedOrigins !== undefined ? { embedOrigins: this.validateEmbedOrigins(input.embedOrigins) } : {}),
        },
        include: { locales: true },
      });
      if (input.embedOrigins !== undefined) {
        await this.activity.record(tx, {
          projectId, actorId: userId, action: 'project.embedOrigins.updated',
          detail: { from: before.embedOrigins, to: project.embedOrigins },
        });
      }
      if (input.name !== undefined && input.name !== before.name) {
        await this.activity.record(tx, {
          projectId, actorId: userId, action: 'project.renamed',
          detail: { from: before.name, to: input.name },
        });
      }
      return project;
    });
  }

  async removeFor(userId: string, projectId: string) {
    await this.requireAdmin(userId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
    return { removed: projectId };
  }

  // Role + locale access helpers (granular permissions).
  private static readonly ROLE_RANK: Record<string, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

  // Resolves the caller's EFFECTIVE grant: the union of their direct team
  // membership and every group grant in the project's team. The strongest
  // role wins; a MEMBER-level effective role is unrestricted when any
  // winning grant has an empty allowedLocales list, otherwise restricted to
  // the union of the winning grants' lists (an ADMIN/OWNER grant is always
  // unrestricted). Teamwide membership stays the outer boundary: a removed
  // team member gets no access from stale group rows.
  private async memberFor(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { teamId: true } });
    if (!project) throw new NotFoundException('Project not found');
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: project.teamId, userId } },
    });
    if (!member) throw new NotFoundException('Project not found'); // no existence leak
    const groupGrants = await this.prisma.groupMember.findMany({
      where: { userId, group: { teamId: project.teamId } },
      include: { group: { select: { role: true, allowedLocales: true } } },
    });
    let role = member.role;
    for (const gm of groupGrants) {
      if (ProjectsService.ROLE_RANK[gm.group.role] > ProjectsService.ROLE_RANK[role]) role = gm.group.role;
    }
    if (role !== 'MEMBER') return { role, allowedLocales: [] as string[] };
    const grants = [{ allowedLocales: member.allowedLocales }, ...groupGrants.filter((gm) => gm.group.role === 'MEMBER').map((gm) => ({ allowedLocales: gm.group.allowedLocales }))];
    if (grants.some((g) => g.allowedLocales.length === 0)) return { role, allowedLocales: [] as string[] };
    return { role, allowedLocales: [...new Set(grants.flatMap((g) => g.allowedLocales))] };
  }

  private async groupFor(userId: string, projectId: string, groupId: string) {
    const member = await this.requireAdmin(userId, projectId);
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { teamId: true } });
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, include: { members: { include: { user: { select: { id: true, email: true, displayName: true } } } } } });
    if (!group || group.teamId !== project.teamId) throw new NotFoundException('Group not found');
    // An admin may not manage a group whose role is not strictly below their
    // own effective role, so power cannot be escalated or seized sideways.
    if (ProjectsService.ROLE_RANK[member.role] <= ProjectsService.ROLE_RANK[group.role]) {
      throw new ForbiddenException('Requires a role above the group role');
    }
    return { group, actorRole: member.role };
  }

  private assertGroupRole(actorRole: string, role: string) {
    if (role === 'OWNER') throw new BadRequestException('A group cannot grant the owner role');
    if (role !== 'ADMIN' && role !== 'MEMBER') throw new BadRequestException('Role must be MEMBER or ADMIN');
    if (ProjectsService.ROLE_RANK[actorRole] <= ProjectsService.ROLE_RANK[role]) {
      throw new ForbiddenException('Cannot grant a role at or above your own');
    }
  }

  async listGroups(userId: string, projectId: string) {
    await this.memberFor(userId, projectId);
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { teamId: true } });
    return this.prisma.group.findMany({
      where: { teamId: project.teamId },
      include: { members: { include: { user: { select: { id: true, email: true, displayName: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  async createGroup(userId: string, projectId: string, name: string, role: string, allowedLocales: string[]) {
    const actor = await this.requireAdmin(userId, projectId);
    this.assertGroupRole(actor.role, role);
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { teamId: true } });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const g = await tx.group.create({
          data: { teamId: project.teamId, name: name.trim(), role: role as any, allowedLocales },
          include: { members: true },
        });
        await this.activity.record(tx, {
          projectId, actorId: userId, action: 'group.created',
          detail: { name: g.name, role: g.role, allowedLocales: g.allowedLocales },
        });
        return g;
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('A group with this name already exists');
      throw e;
    }
  }

  async updateGroup(userId: string, projectId: string, groupId: string, patch: { name?: string; role?: string; allowedLocales?: string[] }) {
    const { group, actorRole } = await this.groupFor(userId, projectId, groupId);
    if (patch.role !== undefined) this.assertGroupRole(actorRole, patch.role);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const g = await tx.group.update({
          where: { id: group.id },
          data: {
            ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
            ...(patch.role !== undefined ? { role: patch.role as any } : {}),
            ...(patch.allowedLocales !== undefined ? { allowedLocales: patch.allowedLocales } : {}),
          },
        });
        await this.activity.record(tx, {
          projectId, actorId: userId, action: 'group.updated',
          detail: { name: g.name, from: { name: group.name, role: group.role, allowedLocales: group.allowedLocales }, to: { name: g.name, role: g.role, allowedLocales: g.allowedLocales } },
        });
        return g;
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('A group with this name already exists');
      throw e;
    }
  }

  async deleteGroup(userId: string, projectId: string, groupId: string) {
    const { group } = await this.groupFor(userId, projectId, groupId);
    await this.prisma.$transaction(async (tx) => {
      // Exclusive side of the task-assignment advisory pair: in-flight
      // group assignments settle before we read the affected set, and new
      // ones block until this transaction commits (then 400 on the missing
      // group) - so the RETURNING set is exactly what this deletion
      // unassigns, never an observed count that a race could skew.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId + '::task-assignment'})::bigint)`;
      // Unassign in the same statement that reports the affected tasks:
      // the count can never drift from the actual result, and the FK's
      // ON DELETE SET NULL stays as a safety net only.
      const affected = await tx.$queryRaw<{ id: string; title: string }[]>`
        UPDATE "tasks" SET "assigneeGroupId" = NULL, "updatedAt" = now() AT TIME ZONE 'UTC'
        WHERE "assigneeGroupId" = ${groupId}::uuid RETURNING "id", "title"`;
      await tx.group.delete({ where: { id: group.id } });
      // Audit each affected task (capped at 50 rows) so the feed shows the
      // per-task change, not only the group deletion.
      for (const t of affected.slice(0, 50)) {
        await this.activity.record(tx, {
          projectId, actorId: userId, action: 'task.updated',
          detail: { title: truncate(t.title, 80), changes: { assigneeGroup: { from: group.name, to: null } } },
        });
      }
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'group.deleted',
        detail: { name: group.name, role: group.role, members: group.members.length, tasksUnassigned: affected.length, tasksAudited: Math.min(50, affected.length) },
      });
    });
    return { ok: true };
  }

  // Group membership presupposes team membership: a group organizes people
  // already in the team, it never extends team access by itself.
  async addGroupMember(userId: string, projectId: string, groupId: string, targetUserId: string) {
    const { group } = await this.groupFor(userId, projectId, groupId);
    const target = await this.prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: group.teamId, userId: targetUserId } } });
    if (!target) throw new BadRequestException('User is not a member of this team');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const gm = await tx.groupMember.create({ data: { groupId: group.id, userId: targetUserId } });
        const user = await tx.user.findUnique({ where: { id: targetUserId }, select: { email: true } });
        await this.activity.record(tx, {
          projectId, actorId: userId, action: 'group.member.added',
          detail: { group: group.name, member: user?.email },
        });
        return gm;
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('User is already in this group');
      throw e;
    }
  }

  async removeGroupMember(userId: string, projectId: string, groupId: string, targetUserId: string) {
    const { group } = await this.groupFor(userId, projectId, groupId);
    const existing = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: targetUserId } } });
    if (!existing) throw new NotFoundException('Group membership not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({ where: { groupId_userId: { groupId: group.id, userId: targetUserId } } });
      const user = await tx.user.findUnique({ where: { id: targetUserId }, select: { email: true } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'group.member.removed',
        detail: { group: group.name, member: user?.email },
      });
    });
    return { ok: true };
  }

  async roleFor(userId: string, projectId: string) {
    return (await this.memberFor(userId, projectId)).role;
  }

  // ADMIN+ for project administration: settings, locales, members, webhooks,
  // snapshot restore. OWNER satisfies every check.
  async requireAdmin(userId: string, projectId: string) {
    const member = await this.memberFor(userId, projectId);
    if (member.role === 'MEMBER') throw new ForbiddenException('Requires an admin role');
    return member;
  }

  // MEMBER with a non-empty allowedLocales list may only write those locales.
  async assertLocaleWrite(userId: string, projectId: string, locales: string[]) {
    const member = await this.memberFor(userId, projectId);
    if (member.role !== 'MEMBER' || member.allowedLocales.length === 0) return member;
    const denied = locales.filter((l) => !member.allowedLocales.includes(l));
    if (denied.length) {
      throw new ForbiddenException(`No write access for locale(s): ${denied.join(', ')}`);
    }
    return member;
  }

  async addMember(userId: string, projectId: string, email: string, role: string, allowedLocales: string[]) {
    await this.requireAdmin(userId, projectId);
    if (role === 'OWNER') throw new BadRequestException('Cannot assign the owner role');
    if (role !== 'ADMIN' && role !== 'MEMBER') throw new BadRequestException('Role must be MEMBER or ADMIN');
    const target = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!target) throw new NotFoundException('No user with that email');
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, include: { locales: true } });
    const codes = new Set(project!.locales.map((l) => l.code));
    const bad = allowedLocales.filter((l) => !codes.has(l));
    if (bad.length) throw new BadRequestException(`Unknown locale(s) for this project: ${bad.join(', ')}`);
    const member = await this.prisma.$transaction(async (tx) => {
      const prior = await tx.teamMember.findUnique({ where: { teamId_userId: { teamId: project!.teamId, userId: target.id } } });
      const m = await tx.teamMember.upsert({
        where: { teamId_userId: { teamId: project!.teamId, userId: target.id } },
        create: { teamId: project!.teamId, userId: target.id, role: role as never, allowedLocales },
        update: { role: role as never, allowedLocales },
      });
      await this.activity.record(tx, prior
        ? { projectId, actorId: userId, action: 'member.updated', detail: { email: target.email, from: { role: prior.role, allowedLocales: prior.allowedLocales }, to: { role: m.role, allowedLocales: m.allowedLocales } } }
        : { projectId, actorId: userId, action: 'member.added', detail: { email: target.email, role: m.role, allowedLocales: m.allowedLocales } });
      return m;
    });
    return { userId: target.id, email: target.email, role: member.role, allowedLocales: member.allowedLocales };
  }

  async updateMember(userId: string, projectId: string, targetUserId: string, input: { role?: string; allowedLocales?: string[] }) {
    await this.requireAdmin(userId, projectId);
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, include: { locales: true } });
    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: project!.teamId, userId: targetUserId } },
    });
    if (!existing) throw new NotFoundException('Member not found');
    if (existing.role === 'OWNER') throw new BadRequestException('Cannot change the owner');
    if (input.role === 'OWNER') throw new BadRequestException('Cannot assign the owner role');
    if (input.role && input.role !== 'ADMIN' && input.role !== 'MEMBER') {
      throw new BadRequestException('Role must be MEMBER or ADMIN');
    }
    if (input.allowedLocales) {
      const codes = new Set(project!.locales.map((l) => l.code));
      const bad = input.allowedLocales.filter((l) => !codes.has(l));
      if (bad.length) throw new BadRequestException(`Unknown locale(s) for this project: ${bad.join(', ')}`);
    }
    const member = await this.prisma.$transaction(async (tx) => {
      const m = await tx.teamMember.update({
        where: { teamId_userId: { teamId: project!.teamId, userId: targetUserId } },
        data: {
          ...(input.role ? { role: input.role as never } : {}),
          ...(input.allowedLocales ? { allowedLocales: input.allowedLocales } : {}),
        },
      });
      const target = await tx.user.findUnique({ where: { id: targetUserId }, select: { email: true } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'member.updated',
        detail: { email: target?.email, from: { role: existing.role, allowedLocales: existing.allowedLocales }, to: { role: m.role, allowedLocales: m.allowedLocales } },
      });
      return m;
    });
    return { userId: member.userId, role: member.role, allowedLocales: member.allowedLocales };
  }

  async removeMember(userId: string, projectId: string, targetUserId: string) {
    await this.requireAdmin(userId, projectId);
    if (targetUserId === userId) throw new BadRequestException('Cannot remove yourself');
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: project!.teamId, userId: targetUserId } },
    });
    if (!existing) throw new NotFoundException('Member not found');
    if (existing.role === 'OWNER') throw new BadRequestException('Cannot remove the owner');
    await this.prisma.$transaction(async (tx) => {
      await tx.teamMember.delete({
        where: { teamId_userId: { teamId: project!.teamId, userId: targetUserId } },
      });
      const target = await tx.user.findUnique({ where: { id: targetUserId }, select: { email: true } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'member.removed',
        detail: { email: target?.email, role: existing.role },
      });
    });
    return { removed: targetUserId };
  }

  async listMembers(userId: string, projectId: string) {
    const project = await this.getFor(userId, projectId);
    const members = await this.prisma.teamMember.findMany({
      where: { teamId: project.teamId },
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { user: { displayName: 'asc' } },
    });
    return members.map((m) => ({ id: m.user.id, displayName: m.user.displayName, email: m.user.email, role: m.role, allowedLocales: m.allowedLocales }));
  }

  async addLocale(userId: string, projectId: string, code: string) {
    await this.requireAdmin(userId, projectId);
    const existing = await this.prisma.projectLocale.findUnique({
      where: { projectId_code: { projectId, code } },
    });
    if (existing) return existing;
    return this.prisma.$transaction(async (tx) => {
      const locale = await tx.projectLocale.create({ data: { projectId, code } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'locale.added', localeCode: code,
      });
      return locale;
    });
  }

  async removeLocale(userId: string, projectId: string, code: string) {
    const project = await this.getFor(userId, projectId);
    if (code === project.baseLocale) {
      throw new ForbiddenException('Cannot remove the base locale');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.projectLocale.delete({
        where: { projectId_code: { projectId, code } },
      });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'locale.removed', localeCode: code,
      });
    });
    return { removed: code };
  }
}
