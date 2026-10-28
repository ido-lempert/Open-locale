import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class KeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async list(userId: string, projectId: string, filters: {
    search?: string; tag?: string; status?: string; locale?: string;
  }) {
    await this.projects.getFor(userId, projectId);
    const { search, tag, status, locale } = filters;
    return this.prisma.key.findMany({
      where: {
        projectId,
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
        ...(status && locale
          ? { translations: { some: { localeCode: locale, status: status as never } } }
          : {}),
      },
      include: { translations: true, _count: { select: { comments: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async setTags(userId: string, projectId: string, keyId: string, tags: string[]) {
    await this.projects.getFor(userId, projectId);
    const existing = await this.prisma.key.findFirst({ where: { id: keyId, projectId } });
    if (!existing) throw new NotFoundException('Key not found');
    const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
    return this.prisma.key.update({ where: { id: keyId }, data: { tags: clean } });
  }

  async create(userId: string, projectId: string, input: {
    name: string; description?: string; isPlural?: boolean; maxLength?: number; tags?: string[];
  }) {
    await this.projects.getFor(userId, projectId);
    return this.prisma.key.create({
      data: {
        projectId,
        name: input.name,
        description: input.description ?? '',
        isPlural: input.isPlural ?? false,
        maxLength: input.maxLength,
        tags: input.tags ?? [],
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

  async listComments(userId: string, projectId: string, keyId: string, locale?: string) {
    await this.projects.getFor(userId, projectId);
    const key = await this.prisma.key.findFirst({ where: { id: keyId, projectId } });
    if (!key) throw new NotFoundException('Key not found');
    return this.prisma.comment.findMany({
      where: { keyId, ...(locale ? { OR: [{ localeCode: locale }, { localeCode: null }] } : {}) },
      include: { author: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  async addComment(userId: string, projectId: string, keyId: string, body: string, locale?: string) {
    const project = await this.projects.getFor(userId, projectId);
    const key = await this.prisma.key.findFirst({ where: { id: keyId, projectId } });
    if (!key) throw new NotFoundException('Key not found');
    if (locale && !project.locales.some((l) => l.code === locale)) {
      throw new NotFoundException(`Locale ${locale} is not part of this project`);
    }
    return this.prisma.comment.create({
      data: { keyId, body, localeCode: locale ?? null, authorId: userId },
      include: { author: { select: { displayName: true, email: true } } },
    });
  }

  async deleteComment(userId: string, projectId: string, keyId: string, commentId: string) {
    await this.projects.getFor(userId, projectId);
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, keyId, key: { projectId } },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Only the author can delete a comment');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { removed: commentId };
  }
}
