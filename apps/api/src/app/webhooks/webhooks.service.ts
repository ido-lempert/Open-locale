import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import { isDeniedIp, privateTargetsAllowed, validateWebhookUrlString, WebhookTargetError } from './egress';
import { deliverPinned, type Resolver } from './transport';
import { lookup } from 'node:dns/promises';

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
    await this.projects.requireAdmin(userId, projectId);
    try {
      validateWebhookUrlString(dto.url);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid webhook URL');
    }
    const secret = dto.secret ?? randomBytes(24).toString('hex');
    const hook = await this.prisma.webhook.create({
      data: { projectId, url: dto.url, events: dto.events, secret },
    });
    // One-time reveal: the only response that ever carries the secret.
    return { ...WebhooksService.publicView(hook), secret };
  }

  async update(userId: string, projectId: string, hookId: string, dto: UpdateWebhookDto) {
    await this.projects.requireAdmin(userId, projectId);
    const existing = await this.prisma.webhook.findFirst({ where: { id: hookId, projectId } });
    if (!existing) throw new NotFoundException('Webhook not found');
    if (dto.url) {
      try {
        validateWebhookUrlString(dto.url);
      } catch (e) {
        throw new BadRequestException(e instanceof Error ? e.message : 'Invalid webhook URL');
      }
    }
    const hook = await this.prisma.webhook.update({
      where: { id: existing.id },
      data: { url: dto.url, events: dto.events, active: dto.active },
    });
    return WebhooksService.publicView(hook);
  }

  async remove(userId: string, projectId: string, hookId: string) {
    await this.projects.requireAdmin(userId, projectId);
    const existing = await this.prisma.webhook.findFirst({ where: { id: hookId, projectId } });
    if (!existing) throw new NotFoundException('Webhook not found');
    await this.prisma.webhook.delete({ where: { id: existing.id } });
    return { removed: hookId };
  }

  // Injectable for tests (hostile-DNS simulation). Production path is dns.lookup.
  resolver: Resolver = async (hostname) => lookup(hostname, { all: true });

  private async resolveApproved(url: URL): Promise<{ address: string; family: number }> {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (privateTargetsAllowed()) {
      // Fixture mode: still pin the connection, but accept private targets.
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return { address: host, family: 4 };
      const all = await this.resolver(host);
      if (!all.length) throw new WebhookTargetError('Webhook host does not resolve');
      return all[0];
    }
    // Single resolution, full validation, then the caller pins this address:
    // there is no second lookup through which DNS could be rebound.
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
      if (isDeniedIp(host)) throw new WebhookTargetError('Webhook target is a denied address range');
      return { address: host, family: host.includes(':') ? 6 : 4 };
    }
    let all: { address: string; family: number }[];
    try {
      all = await this.resolver(host);
    } catch {
      throw new WebhookTargetError('Webhook host does not resolve');
    }
    if (!all.length) throw new WebhookTargetError('Webhook host does not resolve');
    if (all.some((a) => isDeniedIp(a.address))) {
      throw new WebhookTargetError('Webhook host resolves to a denied address range');
    }
    return all[0];
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
        try {
          // Re-validate at the delivery boundary: URL rules, DNS resolution with
          // every address checked, then a connection PINNED to a validated
          // address (hostname preserved for Host/SNI/cert validation).
          const url = validateWebhookUrlString(hook.url);
          const pinned = await this.resolveApproved(url);
          const signature = createHmac('sha256', hook.secret).update(body).digest('hex');
          const res = await deliverPinned(url, pinned, {
            'X-OpenLocale-Event': event,
            'X-OpenLocale-Signature': `sha256=${signature}`,
          }, body);
          if (!res.ok) this.logger.warn(`Webhook ${hook.id} -> ${res.status ?? res.error}`);
        } catch (err) {
          // Never log the URL, payload or secret: URLs may embed internal names.
          this.logger.warn(`Webhook ${hook.id} delivery failed: ${err instanceof Error ? err.message : err}`);
        }
      }),
    );
  }
}
