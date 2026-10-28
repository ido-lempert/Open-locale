import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ActivityService } from '../activity/activity.service';
import { LocksService } from '../locks/locks.service';

export const DEFAULT_BRANCH = 'main';
const BRANCH_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/;

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly locks: LocksService,
  ) {}

  // Resolve a branch by name for a project; default is 'main'. Unknown branch
  // names 404 so typos never silently read or write the wrong branch.
  async branchFor(projectId: string, name?: string | null) {
    const branch = await this.prisma.branch.findUnique({
      where: { projectId_name: { projectId, name: name || DEFAULT_BRANCH } },
    });
    if (!branch) throw new NotFoundException(`Branch '${name || DEFAULT_BRANCH}' not found`);
    return branch;
  }

  async list(userId: string, projectId: string) {
    await this.projects.getFor(userId, projectId);
    return this.prisma.branch.findMany({
      where: { projectId },
      include: { _count: { select: { keys: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, projectId: string, name: string) {
    await this.projects.requireAdmin(userId, projectId);
    if (!BRANCH_NAME.test(name)) {
      throw new BadRequestException('Branch name must be 1-40 chars: letters, digits, dot, dash, underscore; starting with a letter or digit');
    }
    const existing = await this.prisma.branch.findUnique({ where: { projectId_name: { projectId, name } } });
    if (existing) throw new BadRequestException(`Branch '${name}' already exists`);
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({ data: { projectId, name } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'branch.created', detail: { branch: name },
      });
      return branch;
    });
  }

  async remove(userId: string, projectId: string, branchId: string) {
    await this.projects.requireAdmin(userId, projectId);
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, projectId }, include: { _count: { select: { keys: true } } } });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.name === DEFAULT_BRANCH) throw new BadRequestException("The default branch 'main' cannot be deleted");
    return this.prisma.$transaction(async (tx) => {
      await tx.branch.delete({ where: { id: branch.id } }); // cascades its keys
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'branch.deleted',
        detail: { branch: branch.name, keysRemoved: branch._count.keys },
      });
      return { removed: branch.name, keysRemoved: branch._count.keys };
    });
  }

  // Merge source into target: upsert keys by name and copy their translations
  // (value + status). Target-only keys are kept; nothing is deleted. Admin
  // only, under the project lock like imports and restores.
  async merge(userId: string, projectId: string, sourceId: string, intoName: string) {
    await this.projects.requireAdmin(userId, projectId);
    const source = await this.prisma.branch.findFirst({ where: { id: sourceId, projectId } });
    if (!source) throw new NotFoundException('Branch not found');
    const target = await this.prisma.branch.findUnique({ where: { projectId_name: { projectId, name: intoName } } });
    if (!target) throw new NotFoundException(`Branch '${intoName}' not found`);
    if (source.id === target.id) throw new BadRequestException('Cannot merge a branch into itself');
    return this.locks.withProjectLock(projectId, async () =>
      this.prisma.$transaction(async (tx) => {
        const sourceKeys = await tx.key.findMany({ where: { branchId: source.id }, include: { translations: true } });
        let keysMerged = 0, translationsMerged = 0;
        for (const sk of sourceKeys) {
          const tk = await tx.key.upsert({
            where: { branchId_name: { branchId: target.id, name: sk.name } },
            create: {
              projectId, branchId: target.id, name: sk.name,
              description: sk.description, isPlural: sk.isPlural, maxLength: sk.maxLength, tags: sk.tags,
            },
            update: {
              description: sk.description, isPlural: sk.isPlural, maxLength: sk.maxLength, tags: sk.tags,
            },
          });
          if (tk.id !== sk.id) keysMerged++;
          for (const tr of sk.translations) {
            const existing = await tx.translation.findUnique({ where: { keyId_localeCode: { keyId: tk.id, localeCode: tr.localeCode } } });
            if (existing && existing.value === tr.value && existing.status === tr.status) continue;
            await tx.translation.upsert({
              where: { keyId_localeCode: { keyId: tk.id, localeCode: tr.localeCode } },
              create: {
                keyId: tk.id, projectId, localeCode: tr.localeCode, value: tr.value, status: tr.status,
              },
              update: { value: tr.value, status: tr.status },
            });
            translationsMerged++;
          }
        }
        await this.activity.record(tx, {
          projectId, actorId: userId, action: 'branch.merged',
          detail: { from: source.name, into: target.name, keysMerged, translationsMerged },
        });
        return { merged: `${source.name} -> ${target.name}`, keysMerged, translationsMerged };
      }));
  }
}
