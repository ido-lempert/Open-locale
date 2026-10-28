import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { BranchesService } from '../branches/branches.service';
import { LocksService } from '../locks/locks.service';
import { ActivityService, truncate } from '../activity/activity.service';

@Injectable()
export class KeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly branches: BranchesService,
    private readonly locks: LocksService,
  ) {}

  async list(userId: string, projectId: string, filters: {
    search?: string; tag?: string; status?: string; locale?: string; branch?: string;
  }) {
    await this.projects.getFor(userId, projectId);
    const { search, tag, status, locale } = filters;
    const branch = await this.branches.branchFor(projectId, filters.branch);
    return this.prisma.key.findMany({
      where: {
        projectId,
        branchId: branch.id,
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
        ...(status && locale
          ? { translations: { some: { localeCode: locale, status: status as never } } }
          : {}),
      },
      include: { translations: true, _count: { select: { comments: true, screenshots: true } } },
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
    name: string; description?: string; isPlural?: boolean; maxLength?: number; tags?: string[]; branch?: string;
  }) {
    await this.projects.getFor(userId, projectId);
    const branch = await this.branches.branchFor(projectId, input.branch);
    return this.prisma.$transaction(async (tx) => {
      const key = await tx.key.create({
        data: {
          projectId,
          branchId: branch.id,
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
    // Deleting a key removes every locale's value, so a locale-restricted
    // member must not do it: require write access to ALL project locales.
    const project = await this.projects.getFor(userId, projectId);
    await this.projects.assertLocaleWrite(userId, projectId, project.locales.map((l) => l.code));
    const existing = await this.prisma.key.findFirst({ where: { id: keyId, projectId } });
    if (!existing) throw new NotFoundException('Key not found');
    // Serialized with merges/restores/imports: a key (and its translations)
    // cannot vanish mid-merge.
    await this.locks.withProjectLock(projectId, () => this.prisma.$transaction(async (tx) => {
      await tx.key.delete({ where: { id: keyId } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'key.deleted', keyName: existing.name,
      });
    }));
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

  // Declared type AND magic bytes must match; SVG is never accepted (executable).
  private static readonly IMAGE_SIGNATURES: Record<string, { head: number[]; webp?: boolean }> = {
    'image/png': { head: [0x89, 0x50, 0x4e, 0x47] },
    'image/jpeg': { head: [0xff, 0xd8, 0xff] },
    'image/gif': { head: [0x47, 0x49, 0x46, 0x38] },
    'image/webp': { head: [0x52, 0x49, 0x46, 0x46], webp: true },
  };

  async uploadScreenshot(userId: string, projectId: string, keyId: string,
    file?: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    await this.projects.getFor(userId, projectId);
    const key = await this.prisma.key.findFirst({ where: { id: keyId, projectId } });
    if (!key) throw new NotFoundException('Key not found');
    if (!file || !file.buffer?.length) throw new BadRequestException('An image file is required');
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('Screenshot must be 2 MB or smaller');
    const sig = KeysService.IMAGE_SIGNATURES[file.mimetype];
    if (!sig) throw new BadRequestException('Only PNG, JPEG, GIF or WebP images are allowed');
    const head = [...file.buffer.subarray(0, 4)];
    const headOk = sig.head.every((b, i) => head[i] === b);
    const webpOk = !sig.webp || file.buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (!headOk || !webpOk || file.buffer.length !== file.size) {
      throw new BadRequestException('File contents do not match a valid image');
    }
    // Structural trailers: catches truncated/malformed files cheaply. This is
    // NOT full decode validation - we never decode server-side (2 MB bound);
    // dimension/decompression checks would need a real decoder (recorded).
    const b = file.buffer;
    const trailerOk =
      (file.mimetype === 'image/png' && b.length >= 12 && b.subarray(b.length - 8, b.length - 4).toString('ascii') === 'IEND') ||
      (file.mimetype === 'image/jpeg' && b.length >= 4 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9) ||
      (file.mimetype === 'image/gif' && b.length >= 14 && b[b.length - 1] === 0x3b) ||
      (file.mimetype === 'image/webp' && b.length >= 12 && b.readUInt32LE(4) + 8 === b.length);
    if (!trailerOk) {
      throw new BadRequestException('File contents do not match a valid image');
    }
    const filename = (file.originalname || 'screenshot').split(/[\\/]/).pop()!.slice(0, 120);
    return this.prisma.$transaction(async (tx) => {
      const shot = await tx.screenshot.create({
        data: { keyId, projectId, filename, mimeType: file.mimetype, byteSize: file.size, data: new Uint8Array(file.buffer), uploadedById: userId },
        select: { id: true, filename: true, mimeType: true, byteSize: true, createdAt: true },
      });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'screenshot.added', keyName: key.name,
        detail: { filename, byteSize: file.size },
      });
      return shot;
    });
  }

  async listScreenshots(userId: string, projectId: string, keyId: string) {
    await this.projects.getFor(userId, projectId);
    const key = await this.prisma.key.findFirst({ where: { id: keyId, projectId } });
    if (!key) throw new NotFoundException('Key not found');
    return this.prisma.screenshot.findMany({
      where: { keyId },
      select: {
        id: true, filename: true, mimeType: true, byteSize: true, createdAt: true,
        uploader: { select: { displayName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getScreenshot(userId: string, projectId: string, keyId: string, screenshotId: string) {
    await this.projects.getFor(userId, projectId);
    const shot = await this.prisma.screenshot.findFirst({
      where: { id: screenshotId, keyId, projectId },
    });
    if (!shot) throw new NotFoundException('Screenshot not found');
    return shot;
  }

  async deleteScreenshot(userId: string, projectId: string, keyId: string, screenshotId: string) {
    await this.projects.getFor(userId, projectId);
    const shot = await this.prisma.screenshot.findFirst({
      where: { id: screenshotId, keyId, projectId },
      include: { key: { select: { name: true } } },
    });
    if (!shot) throw new NotFoundException('Screenshot not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.screenshot.delete({ where: { id: screenshotId } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'screenshot.deleted', keyName: shot.key.name,
        detail: { filename: shot.filename },
      });
    });
    return { removed: screenshotId };
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
