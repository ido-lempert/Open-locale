import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger('Webhooks');

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  private static publicView(w: { id: string; url: string; events: string[]; active: boolean; createdAt: Date }) {
    // The signing secret is deliberately absent from every read path.
    return { id: w.id, url: w.url, events: w.events, active: w.active, createdAt: w.createdAt };
  }

  async list(userId: string, projectId: string) {
    await this.projects.getFor(userId, projectId);
    const hooks = await this.prisma.webhook.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
    return hooks.map(WebhooksService.publicView);
  }

  async create(userId: string, projectId: string, dto: CreateWebhookDto) {
    await this.projects.getFor(userId, projectId);
    const secret = dto.secret ?? randomBytes(24).toString('hex');
    const hook = await this.prisma.webhook.create({
      data: { projectId, url: dto.url, events: dto.events, secret },
    });
    // One-time reveal: the only response that ever carries the secret.
    return { ...WebhooksService.publicView(hook), secret };
  }

  async update(userId: string, projectId: string, hookId: string, dto: UpdateWebhookDto) {
    await this.projects.getFor(userId, projectId);
    const existing = await this.prisma.webhook.findFirst({ where: { id: hookId, projectId } });
    if (!existing) throw new NotFoundException('Webhook not found');
    const hook = await this.prisma.webhook.update({
      where: { id: existing.id },
      data: { url: dto.url, events: dto.events, active: dto.active },
    });
    return WebhooksService.publicView(hook);
  }

  async remove(userId: string, projectId: string, hookId: string) {
    await this.projects.getFor(userId, projectId);
    const existing = await this.prisma.webhook.findFirst({ where: { id: hookId, projectId } });
    if (!existing) throw new NotFoundException('Webhook not found');
    await this.prisma.webhook.delete({ where: { id: existing.id } });
    return { removed: hookId };
  }

  // Fire-and-forget delivery. Delivery failure must never fail the write that
  // triggered it, so callers invoke this without awaiting user-facing latency.
  async deliver(projectId: string, event: string, payload: Record<string, unknown>) {
    const hooks = await this.prisma.webhook.findMany({
      where: { projectId, active: true, events: { has: event } },
    });
    const body = JSON.stringify({ event, ...payload, at: new Date().toISOString() });
    await Promise.allSettled(
      hooks.map(async (hook) => {
        const signature = createHmac('sha256', hook.secret).update(body).digest('hex');
        try {
          const res = await fetch(hook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-OpenLocale-Event': event,
              'X-OpenLocale-Signature': `sha256=${signature}`,
            },
            body,
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) this.logger.warn(`Webhook ${hook.id} -> ${res.status}`);
        } catch (err) {
          this.logger.warn(`Webhook ${hook.id} delivery failed: ${err instanceof Error ? err.message : err}`);
        }
      }),
    );
  }
}
