import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  private assertSingleAssignee(assigneeId?: string | null, assigneeGroupId?: string | null) {
    if (assigneeId && assigneeGroupId) {
      throw new BadRequestException('Assign a task to a member or a group, not both');
    }
  }

  private readonly includePeople = {
    assignee: { select: { id: true, displayName: true, email: true } },
    assigneeGroup: { select: { id: true, name: true, role: true } },
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
  }) {
    const project = await this.projects.getFor(userId, projectId);
    this.assertSingleAssignee(input.assigneeId, input.assigneeGroupId);
    if (input.assigneeId) await this.assertAssigneeMember(project.teamId, input.assigneeId);
    if (input.assigneeGroupId) await this.assertAssigneeGroup(project.teamId, input.assigneeGroupId);
    return this.prisma.$transaction((tx) => this.createIn(tx, userId, projectId, input));
  }

  // Creates the task inside a caller-owned transaction (used by automations
  // for atomic check-then-create under an advisory lock). The caller must
  // already have validated membership and any assignee.
  async createIn(tx: Prisma.TransactionClient, userId: string, projectId: string, input: {
    title: string; description?: string; dueDate?: string; assigneeId?: string; assigneeGroupId?: string;
  }) {
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Title cannot be empty');
    const task = await tx.task.create({
      data: {
        projectId, title, description: input.description?.trim() ?? '',
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        assigneeId: input.assigneeId ?? null, assigneeGroupId: input.assigneeGroupId ?? null,
        creatorId: userId,
      },
      include: this.includePeople,
    });
    await this.activity.record(tx, {
      projectId, actorId: userId, action: 'task.created',
      detail: { title: truncate(title, 80) },
    });
    return task;
  }

  async update(userId: string, projectId: string, taskId: string, input: {
    title?: string; description?: string; status?: 'OPEN' | 'IN_PROGRESS' | 'DONE';
    dueDate?: string | null; assigneeId?: string | null; assigneeGroupId?: string | null;
  }) {
    const project = await this.projects.getFor(userId, projectId);
    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: { assigneeGroup: { select: { id: true, name: true } } },
    });
    if (!existing) throw new NotFoundException('Task not found');
    this.assertSingleAssignee(input.assigneeId, input.assigneeGroupId);
    if (input.assigneeId) await this.assertAssigneeMember(project.teamId, input.assigneeId);
    if (input.assigneeGroupId) await this.assertAssigneeGroup(project.teamId, input.assigneeGroupId);
    return this.prisma.$transaction(async (tx) => {
      if (input.title !== undefined && !input.title.trim()) {
        throw new BadRequestException('Title cannot be empty');
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
          // Assigning one kind clears the other (single-assignee invariant).
          ...(input.assigneeId ? { assigneeGroupId: null } : {}),
          ...(input.assigneeGroupId ? { assigneeId: null } : {}),
        },
        include: this.includePeople,
      });
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
