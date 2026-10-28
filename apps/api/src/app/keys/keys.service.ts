import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ActivityService, truncate } from '../activity/activity.service';

@Injectable()
export class KeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
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
    return this.prisma.$transaction(async (tx) => {
      const key = await tx.key.update({ where: { id: keyId }, data: { tags: clean } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'key.tags', keyName: existing.name,
        detail: { tags: clean },
      });
      return key;
    });
  }

  async create(userId: string, projectId: string, input: {
    name: string; description?: string; isPlural?: boolean; maxLength?: number; tags?: string[];
  }) {
    await this.projects.getFor(userId, projectId);
    return this.prisma.$transaction(async (tx) => {
      const key = await tx.key.create({
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
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'key.created', keyName: input.name,
      });
      return key;
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
    await this.prisma.$transaction(async (tx) => {
      await tx.key.delete({ where: { id: keyId } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'key.deleted', keyName: existing.name,
      });
    });
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
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { keyId, body, localeCode: locale ?? null, authorId: userId },
        include: { author: { select: { displayName: true, email: true } } },
      });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'comment.added',
        keyName: key.name, localeCode: locale ?? undefined,
      });
      return comment;
    });
  }

  async deleteComment(userId: string, projectId: string, keyId: string, commentId: string) {
    await this.projects.getFor(userId, projectId);
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, keyId, key: { projectId } },
      include: { key: { select: { name: true } } },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Only the author can delete a comment');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'comment.deleted',
        keyName: comment.key.name, localeCode: comment.localeCode ?? undefined,
        detail: { excerpt: truncate(comment.body, 80) },
      });
    });
    return { removed: commentId };
  }
}
