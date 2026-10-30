import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Keep this list in sync with every record() call site.
export const ACTIVITY_ACTIONS = [
  'key.created',
  'key.deleted',
  'key.tags',
  'translation.value',
  'translation.status',
  'comment.added',
  'comment.deleted',
  'project.renamed',
  'project.import',
  'locale.added',
  'locale.removed',
  'screenshot.added',
  'screenshot.deleted',
  'task.created',
  'task.updated',
  'task.deleted',
  'glossary.created',
  'glossary.updated',
  'glossary.deleted',
  'snapshot.created',
  'snapshot.restored',
  'branch.created',
  'branch.deleted',
  'branch.merged',
  'ota.published',
  'project.embedOrigins.updated',
  'mt.pretranslate',
  'automation.run',
  'member.added',
  'member.updated',
  'member.removed',
  'group.created',
  'group.updated',
  'group.deleted',
  'group.member.added',
  'group.member.removed',
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface ActivityEventInput {
  projectId: string;
  actorId: string | null;
  action: ActivityAction;
  keyName?: string;
  localeCode?: string;
  detail?: Prisma.InputJsonValue;
}

export const truncate = (v: string, max = 200): string =>
  v.length > max ? `${v.slice(0, max)}…` : v;

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  // Always call with the same transaction client as the mutation it audits,
  // so a change and its audit record commit or roll back together.
  record(tx: Prisma.TransactionClient, event: ActivityEventInput) {
    return tx.activityEvent.create({
      data: {
        projectId: event.projectId,
        actorId: event.actorId,
        action: event.action,
        keyName: event.keyName ?? null,
        localeCode: event.localeCode ?? null,
        detail: event.detail,
      },
    });
  }

  // Authz is the caller's job (the controller checks membership first).
  async list(projectId: string, filters: { action?: string; actorId?: string; key?: string; limit: number; cursor?: string }) {
    const events = await this.prisma.activityEvent.findMany({
      where: {
        projectId,
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.actorId ? { actorId: filters.actorId } : {}),
        // Target filter: the key the event acted on (keyName is a snapshot
        // column, so filtering survives key deletion).
        ...(filters.key ? { keyName: { contains: filters.key, mode: 'insensitive' as const } } : {}),
      },
      include: { actor: { select: { displayName: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filters.limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
    const hasMore = events.length > filters.limit;
    const items = hasMore ? events.slice(0, filters.limit) : events;
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }
}
