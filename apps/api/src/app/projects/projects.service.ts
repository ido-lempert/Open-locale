import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

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

  async updateFor(userId: string, projectId: string, input: { name?: string; description?: string; customStatuses?: string[] }) {
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
        },
        include: { locales: true },
      });
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
  private async memberFor(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { teamId: true } });
    if (!project) throw new NotFoundException('Project not found');
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: project.teamId, userId } },
    });
    if (!member) throw new NotFoundException('Project not found'); // no existence leak
    return member;
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
    const member = await this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: project!.teamId, userId: target.id } },
      create: { teamId: project!.teamId, userId: target.id, role: role as never, allowedLocales },
      update: { role: role as never, allowedLocales },
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
    const member = await this.prisma.teamMember.update({
      where: { teamId_userId: { teamId: project!.teamId, userId: targetUserId } },
      data: {
        ...(input.role ? { role: input.role as never } : {}),
        ...(input.allowedLocales ? { allowedLocales: input.allowedLocales } : {}),
      },
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
    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId: project!.teamId, userId: targetUserId } },
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
