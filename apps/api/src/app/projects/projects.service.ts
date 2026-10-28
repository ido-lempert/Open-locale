import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

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
    await this.getFor(userId, projectId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.description !== undefined ? { description: input.description } : {}) },
      include: { locales: true },
    });
  }

  async removeFor(userId: string, projectId: string) {
    await this.getFor(userId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
    return { removed: projectId };
  }

  async addLocale(userId: string, projectId: string, code: string) {
    await this.getFor(userId, projectId);
    return this.prisma.projectLocale.upsert({
      where: { projectId_code: { projectId, code } },
      create: { projectId, code },
      update: {},
    });
  }

  async removeLocale(userId: string, projectId: string, code: string) {
    const project = await this.getFor(userId, projectId);
    if (code === project.baseLocale) {
      throw new ForbiddenException('Cannot remove the base locale');
    }
    await this.prisma.projectLocale.delete({
      where: { projectId_code: { projectId, code } },
    });
    return { removed: code };
  }
}
