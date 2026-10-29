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

  private readonly includePeople = {
    assignee: { select: { id: true, displayName: true, email: true } },
    creator: { select: { id: true, displayName: true, email: true } },
  } as const;

  async list(userId: string, projectId: string, status?: string) {
    await this.projects.getFor(userId, projectId);
    return this.prisma.task.findMany({
      where: { projectId, ...(status ? { status: status as never } : {}) },
      include: this.includePeople,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async create(userId: string, projectId: string, input: {
    title: string; description?: string; dueDate?: string; assigneeId?: string;
  }) {
    const project = await this.projects.getFor(userId, projectId);
    if (input.assigneeId) await this.assertAssigneeMember(project.teamId, input.assigneeId);
    return this.prisma.$transaction((tx) => this.createIn(tx, userId, projectId, input));
  }

  // Creates the task inside a caller-owned transaction (used by automations
  // for atomic check-then-create under an advisory lock). The caller must
  // already have validated membership and any assignee.
  async createIn(tx: Prisma.TransactionClient, userId: string, projectId: string, input: {
    title: string; description?: string; dueDate?: string; assigneeId?: string;
  }) {
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Title cannot be empty');
    const task = await tx.task.create({
      data: {
        projectId, title, description: input.description?.trim() ?? '',
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        assigneeId: input.assigneeId ?? null, creatorId: userId,
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
    dueDate?: string | null; assigneeId?: string | null;
  }) {
    const project = await this.projects.getFor(userId, projectId);
    const existing = await this.prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!existing) throw new NotFoundException('Task not found');
    if (input.assigneeId) await this.assertAssigneeMember(project.teamId, input.assigneeId);
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
        },
        include: this.includePeople,
      });
      const changes: Record<string, Prisma.InputJsonValue> = {};
      if (input.status !== undefined && input.status !== existing.status) {
        changes['status'] = { from: existing.status, to: input.status };
      }
      if (input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId) {
        changes['assignee'] = { from: existing.assigneeId, to: input.assigneeId };
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
