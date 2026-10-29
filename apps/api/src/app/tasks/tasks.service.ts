import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ActivityService, truncate } from '../activity/activity.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
  ) {}

  async assertAssigneeMember(projectTeamId: string, assigneeId: string) {
    const member = await this.prisma.teamMember.findFirst({
      where: { teamId: projectTeamId, userId: assigneeId },
    });
    if (!member) throw new BadRequestException('Assignee is not a member of this team');
  }

  async assertAssigneeGroup(projectTeamId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, teamId: projectTeamId },
    });
    if (!group) throw new BadRequestException('Assignee group is not part of this team');
  }

  // Validates the dependency target: same project, and no cycle when
  // attached under taskId (null when creating). Walks the chain with a
  // visited set so a corrupted cycle can never loop the query. Must be
  // called inside a transaction that already holds the per-project graph
  // lock (graphLock), so concurrent opposing updates serialize and the
  // second walk observes the first's committed edge.
  private async assertDependency(db: Prisma.TransactionClient, projectId: string, dependsOnId: string, taskId: string | null) {
    const visited = new Set<string>(taskId ? [taskId] : []);
    let cursor: string | null = dependsOnId;
    while (cursor) {
      if (visited.has(cursor)) throw new BadRequestException('Task dependency would create a cycle');
      visited.add(cursor);
      const pred: { id: string; dependsOnId: string | null } | null = await db.task.findFirst({
        where: { id: cursor, projectId },
        select: { id: true, dependsOnId: true },
      });
      if (!pred) throw new BadRequestException('Dependency task is not part of this project');
      cursor = pred.dependsOnId;
    }
  }

  // Task key locks: while a lockKeys task is not DONE, only its assignee
  // (direct or via the assigned group) or a team ADMIN/OWNER may edit the
  // covered keys' translations. Called from the translations write paths.
  async assertKeysEditable(userId: string, projectId: string, keyIds: string[]) {
    if (keyIds.length === 0) return;
    const locking = await this.prisma.task.findFirst({
      where: { projectId, lockKeys: true, status: { not: 'DONE' }, keys: { some: { keyId: { in: keyIds } } } },
      select: {
        title: true, assigneeId: true,
        assigneeGroup: { select: { members: { select: { userId: true } } } },
      },
    });
    if (!locking) return;
    if (locking.assigneeId === userId) return;
    if (locking.assigneeGroup?.members.some((m) => m.userId === userId)) return;
    const role = await this.projects.roleFor(userId, projectId);
    if (role !== 'MEMBER') return; // ADMIN/OWNER override
    throw new ForbiddenException(`Key is locked by task "${locking.title}"`);
  }

  private async assertKeysInProject(db: Prisma.TransactionClient | PrismaService, projectId: string, keyIds: string[]) {
    const found = await db.key.count({ where: { id: { in: keyIds }, projectId } });
    if (found !== new Set(keyIds).size) {
      throw new BadRequestException('Locked keys must belong to this project');
    }
  }

  // Per-project advisory lock serializing dependency-graph mutations
  // (dependency writes and status transitions gated on them). Without it
  // two opposing PATCHes (A->B, B->A) could both pass their cycle walks.
  private async graphLock(tx: Prisma.TransactionClient, projectId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId + '::task-graph'}))`;
  }

  private assertSingleAssignee(assigneeId?: string | null, assigneeGroupId?: string | null) {
    if (assigneeId && assigneeGroupId) {
      throw new BadRequestException('Assign a task to a member or a group, not both');
    }
  }

  private readonly includePeople = {
    assignee: { select: { id: true, displayName: true, email: true } },
    assigneeGroup: { select: { id: true, name: true, role: true } },
    dependsOn: { select: { id: true, title: true, status: true } },
    keys: { select: { key: { select: { id: true, name: true } } } },
    creator: { select: { id: true, displayName: true, email: true } },
  } as const;

  async list(userId: string, projectId: string, status?: string, mine?: boolean) {
    await this.projects.getFor(userId, projectId);
    return this.prisma.task.findMany({
      where: {
        projectId,
        ...(status ? { status: status as never } : {}),
        // "mine" = assigned to me directly or to a group I belong to.
        ...(mine ? { OR: [{ assigneeId: userId }, { assigneeGroup: { members: { some: { userId } } } }] } : {}),
      },
      include: this.includePeople,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async create(userId: string, projectId: string, input: {
    title: string; description?: string; dueDate?: string; assigneeId?: string; assigneeGroupId?: string;
    dependsOnId?: string; lockKeys?: boolean; keyIds?: string[];
  }) {
    const project = await this.projects.getFor(userId, projectId);
    this.assertSingleAssignee(input.assigneeId, input.assigneeGroupId);
    if (input.assigneeId) await this.assertAssigneeMember(project.teamId, input.assigneeId);
    if (input.assigneeGroupId) await this.assertAssigneeGroup(project.teamId, input.assigneeGroupId);
    return this.prisma.$transaction(async (tx) => {
      if (input.dependsOnId) {
        await this.graphLock(tx, projectId);
        await this.assertDependency(tx, projectId, input.dependsOnId, null);
      }
      if (input.keyIds?.length) await this.assertKeysInProject(tx, projectId, input.keyIds);
      return this.createIn(tx, userId, projectId, input);
    });
  }

  // Creates the task inside a caller-owned transaction (used by automations
  // for atomic check-then-create under an advisory lock). The caller must
  // already have validated membership and any assignee.
  async createIn(tx: Prisma.TransactionClient, userId: string, projectId: string, input: {
    title: string; description?: string; dueDate?: string; assigneeId?: string; assigneeGroupId?: string;
    dependsOnId?: string; lockKeys?: boolean; keyIds?: string[];
  }) {
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Title cannot be empty');
    const task = await tx.task.create({
      data: {
        projectId, title, description: input.description?.trim() ?? '',
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        assigneeId: input.assigneeId ?? null, assigneeGroupId: input.assigneeGroupId ?? null,
        dependsOnId: input.dependsOnId ?? null, lockKeys: input.lockKeys ?? false,
        creatorId: userId,
      },
      include: this.includePeople,
    });
    if (input.keyIds?.length) {
      await tx.taskKey.createMany({ data: input.keyIds.map((keyId) => ({ taskId: task.id, keyId })) });
      // The create's include resolved before the key rows existed; re-read.
      return tx.task.findUniqueOrThrow({ where: { id: task.id }, include: this.includePeople });
    }
    await this.activity.record(tx, {
      projectId, actorId: userId, action: 'task.created',
      detail: { title: truncate(title, 80) },
    });
    return task;
  }

  async update(userId: string, projectId: string, taskId: string, input: {
    title?: string; description?: string; status?: 'OPEN' | 'IN_PROGRESS' | 'DONE';
    dueDate?: string | null; assigneeId?: string | null; assigneeGroupId?: string | null;
    dependsOnId?: string | null; lockKeys?: boolean; keyIds?: string[];
  }) {
    const project = await this.projects.getFor(userId, projectId);
    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: {
        assigneeGroup: { select: { id: true, name: true } },
        dependsOn: { select: { id: true, title: true, status: true } },
        keys: { select: { key: { select: { id: true, name: true } } } },
      },
    });
    if (!existing) throw new NotFoundException('Task not found');
    this.assertSingleAssignee(input.assigneeId, input.assigneeGroupId);
    if (input.assigneeId) await this.assertAssigneeMember(project.teamId, input.assigneeId);
    if (input.assigneeGroupId) await this.assertAssigneeGroup(project.teamId, input.assigneeGroupId);
    return this.prisma.$transaction(async (tx) => {
      if (input.title !== undefined && !input.title.trim()) {
        throw new BadRequestException('Title cannot be empty');
      }
      // Serialize graph mutations: dependency writes and status
      // transitions (which the chain gate reads) take the per-project
      // lock before any check, so concurrent updates see each other's
      // committed state.
      const touchesGraph = input.dependsOnId !== undefined || (input.status !== undefined && input.status !== existing.status);
      if (touchesGraph) await this.graphLock(tx, projectId);
      if (input.dependsOnId) await this.assertDependency(tx, projectId, input.dependsOnId, taskId);
      // The chain gates every forward transition out of OPEN (starting OR
      // completing), and also attaching/changing the predecessor on a
      // task already past OPEN: in both cases the new predecessor must be
      // DONE. The predecessor's status is read inside the same
      // transaction as the update. Reopening (any -> OPEN) stays allowed.
      const targetStatus = input.status ?? existing.status;
      const targetDependsOn = input.dependsOnId !== undefined ? input.dependsOnId : existing.dependsOnId;
      const changingDependency = input.dependsOnId !== undefined && input.dependsOnId !== existing.dependsOnId;
      const movingForward = targetStatus !== existing.status && targetStatus !== 'OPEN';
      if (targetDependsOn && (movingForward || (changingDependency && existing.status !== 'OPEN'))) {
        const blocked = await tx.task.findFirst({
          where: { id: targetDependsOn, status: { not: 'DONE' } },
          select: { id: true },
        });
        if (blocked) throw new BadRequestException('Task is blocked until its predecessor is done');
      }
      const task = await tx.task.update({
        where: { id: taskId },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate === null ? null : new Date(input.dueDate) } : {}),
          ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
          ...(input.assigneeGroupId !== undefined ? { assigneeGroupId: input.assigneeGroupId } : {}),
          ...(input.dependsOnId !== undefined ? { dependsOnId: input.dependsOnId } : {}),
          ...(input.lockKeys !== undefined ? { lockKeys: input.lockKeys } : {}),
          // Assigning one kind clears the other (single-assignee invariant).
          ...(input.assigneeId ? { assigneeGroupId: null } : {}),
          ...(input.assigneeGroupId ? { assigneeId: null } : {}),
        },
        include: this.includePeople,
      });
      if (input.keyIds !== undefined) {
        await this.assertKeysInProject(tx, projectId, input.keyIds);
        await tx.taskKey.deleteMany({ where: { taskId } });
        if (input.keyIds.length) {
          await tx.taskKey.createMany({ data: input.keyIds.map((keyId) => ({ taskId, keyId })) });
        }
        // The update's include resolved before the key rows changed; re-read.
        task.keys = await tx.taskKey.findMany({ where: { taskId }, select: { key: { select: { id: true, name: true } } } });
      }
      const changes: Record<string, Prisma.InputJsonValue> = {};
      if (input.status !== undefined && input.status !== existing.status) {
        changes['status'] = { from: existing.status, to: input.status };
      }
      const newAssigneeId = input.assigneeGroupId ? null : (input.assigneeId !== undefined ? input.assigneeId : existing.assigneeId);
      const newGroupId = input.assigneeId ? null : (input.assigneeGroupId !== undefined ? input.assigneeGroupId : existing.assigneeGroupId);
      if (newAssigneeId !== existing.assigneeId) {
        changes['assignee'] = { from: existing.assigneeId, to: newAssigneeId };
      }
      if (newGroupId !== existing.assigneeGroupId) {
        const toGroup = newGroupId ? await tx.group.findUnique({ where: { id: newGroupId }, select: { name: true } }) : null;
        changes['assigneeGroup'] = { from: existing.assigneeGroup?.name ?? null, to: toGroup?.name ?? null };
      }
      if (input.lockKeys !== undefined && input.lockKeys !== existing.lockKeys) {
        changes['lockKeys'] = { from: existing.lockKeys, to: input.lockKeys };
      }
      if (input.keyIds !== undefined) {
        const fromNames = existing.keys.map((k) => k.key.name).sort();
        const toKeys = await tx.key.findMany({ where: { id: { in: input.keyIds } }, select: { name: true } });
        const toNames = toKeys.map((k) => k.name).sort();
        if (JSON.stringify(fromNames) !== JSON.stringify(toNames)) {
          changes['lockedKeys'] = { from: fromNames.slice(0, 5), to: toNames.slice(0, 5) };
        }
      }
      if (input.dependsOnId !== undefined && input.dependsOnId !== existing.dependsOnId) {
        const toPred = input.dependsOnId ? await tx.task.findUnique({ where: { id: input.dependsOnId }, select: { title: true } }) : null;
        changes['dependsOn'] = { from: existing.dependsOn ? truncate(existing.dependsOn.title, 80) : null, to: toPred ? truncate(toPred.title, 80) : null };
      }
      if (input.title !== undefined && input.title.trim() !== existing.title) {
        changes['title'] = { from: truncate(existing.title, 80), to: truncate(input.title.trim(), 80) };
      }
      if (input.dueDate !== undefined) {
        changes['dueDate'] = { from: existing.dueDate, to: input.dueDate };
      }
      if (Object.keys(changes).length > 0) {
        await this.activity.record(tx, {
          projectId, actorId: userId, action: 'task.updated',
          detail: { title: truncate(task.title, 80), changes },
        });
      }
      return task;
    });
  }

  async remove(userId: string, projectId: string, taskId: string) {
    await this.projects.getFor(userId, projectId);
    const existing = await this.prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!existing) throw new NotFoundException('Task not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.task.delete({ where: { id: taskId } });
      await this.activity.record(tx, {
        projectId, actorId: userId, action: 'task.deleted',
        detail: { title: truncate(existing.title, 80) },
      });
    });
    return { removed: taskId };
  }
}
