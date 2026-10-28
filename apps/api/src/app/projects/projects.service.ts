import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
      },
      include: { locales: true },
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

  async updateFor(userId: string, projectId: string, input: { name?: string; description?: string }) {
    const before = await this.getFor(userId, projectId);
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id: projectId },
        data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.description !== undefined ? { description: input.description } : {}) },
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
    await this.getFor(userId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
    return { removed: projectId };
  }

  async listMembers(userId: string, projectId: string) {
    const project = await this.getFor(userId, projectId);
    const members = await this.prisma.teamMember.findMany({
      where: { teamId: project.teamId },
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { user: { displayName: 'asc' } },
    });
    return members.map((m) => ({ id: m.user.id, displayName: m.user.displayName, email: m.user.email, role: m.role }));
  }

  async addLocale(userId: string, projectId: string, code: string) {
    await this.getFor(userId, projectId);
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
