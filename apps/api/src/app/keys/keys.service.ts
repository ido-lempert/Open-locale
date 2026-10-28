import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class KeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async list(userId: string, projectId: string, search?: string) {
    await this.projects.getFor(userId, projectId);
    return this.prisma.key.findMany({
      where: {
        projectId,
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      include: { translations: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(userId: string, projectId: string, input: {
    name: string; description?: string; isPlural?: boolean; maxLength?: number;
  }) {
    await this.projects.getFor(userId, projectId);
    return this.prisma.key.create({
      data: {
        projectId,
        name: input.name,
        description: input.description ?? '',
        isPlural: input.isPlural ?? false,
        maxLength: input.maxLength,
      },
      include: { translations: true },
    });
  }

  async update(userId: string, projectId: string, keyId: string, input: {
    description?: string; isPlural?: boolean; maxLength?: number;
  }) {
    await this.projects.getFor(userId, projectId);
    const existing = await this.prisma.key.findFirst({ where: { id: keyId, projectId } });
    if (!existing) throw new NotFoundException('Key not found');
    return this.prisma.key.update({ where: { id: keyId }, data: input });
  }

  async remove(userId: string, projectId: string, keyId: string) {
    await this.projects.getFor(userId, projectId);
    const existing = await this.prisma.key.findFirst({ where: { id: keyId, projectId } });
    if (!existing) throw new NotFoundException('Key not found');
    await this.prisma.key.delete({ where: { id: keyId } });
    return { removed: existing.name };
  }
}
