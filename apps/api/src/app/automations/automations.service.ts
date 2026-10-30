import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ActivityService } from '../activity/activity.service';
import { MtService } from '../mt/mt.service';
import { TasksService } from '../tasks/tasks.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto, AUTOMATION_LOCALE_CAP } from './dto';

// Automations fire ONLY from explicit in-process hooks (key creation and
// base-locale value writes on the main branch). Actions have internal
// effects only: pretranslate (the built-in offline drivers) and task
// creation. No rule can call an external service, and automation writes do
// not re-trigger rules (pretranslate writes bypass the upsert hook), so a
// rule chain cannot recurse.
@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly mt: MtService,
    private readonly tasks: TasksService,
    private readonly webhooks: WebhooksService,
  ) {}

  async list(userId: string, projectId: string) {
    await this.projects.getFor(userId, projectId);
    return this.prisma.automationRule.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
  }

  private async validateConfig(userId: string, projectId: string, trigger: string, action: string, config: Record<string, unknown>) {
    if (trigger === 'key.created' && action === 'pretranslate') {
      throw new BadRequestException("key.created cannot drive pretranslate: a new key has no source text yet");
    }
    if (action === 'pretranslate') {
      const providerId = config.providerId;
      const locales = config.locales;
      if (typeof providerId !== 'string') throw new BadRequestException('config.providerId is required');
      if (!Array.isArray(locales) || !locales.length || locales.length > AUTOMATION_LOCALE_CAP || !locales.every((l) => typeof l === 'string')) {
        throw new BadRequestException(`config.locales must be 1..${AUTOMATION_LOCALE_CAP} locale codes`);
      }
      const provider = await this.prisma.mtProvider.findFirst({ where: { id: providerId, projectId } });
      if (!provider) throw new BadRequestException('config.providerId is not a provider in this project');
      const project = await this.projects.getFor(userId, projectId);
      const codes = project.locales.map((l) => l.code);
      const bad = locales.filter((l) => !codes.includes(l) || l === project.baseLocale);
      if (bad.length) throw new BadRequestException(`config.locales must be non-base project locales: ${bad.join(', ')}`);
    } else if (action === 'notify') {
      const message = config.message;
      if (typeof message !== 'string' || !message.trim() || message.length > 200) {
        throw new BadRequestException('config.message is required (max 200 chars, may contain {key})');
      }
    } else if (action === 'task.create') {
      const title = config.title;
      if (typeof title !== 'string' || !title.trim() || title.length > 200) {
        throw new BadRequestException('config.title is required (max 200 chars, may contain {key})');
      }
      if (config.assigneeId !== undefined && typeof config.assigneeId !== 'string') {
        throw new BadRequestException('config.assigneeId must be a user id');
      }
    }
  }

  async create(userId: string, projectId: string, dto: CreateAutomationRuleDto) {
    await this.projects.requireAdmin(userId, projectId);
    await this.validateConfig(userId, projectId, dto.trigger, dto.action, dto.config ?? {});
    return this.prisma.automationRule.create({
      data: { projectId, name: dto.name, trigger: dto.trigger, action: dto.action, config: (dto.config ?? {}) as Prisma.InputJsonValue, enabled: dto.enabled ?? true, creatorId: userId },
    });
  }

  async update(userId: string, projectId: string, ruleId: string, dto: UpdateAutomationRuleDto) {
    await this.projects.requireAdmin(userId, projectId);
    const rule = await this.prisma.automationRule.findFirst({ where: { id: ruleId, projectId } });
    if (!rule) throw new NotFoundException('Rule not found');
    if (dto.config) await this.validateConfig(userId, projectId, rule.trigger, rule.action, dto.config);
    return this.prisma.automationRule.update({
      where: { id: rule.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async remove(userId: string, projectId: string, ruleId: string) {
    await this.projects.requireAdmin(userId, projectId);
    const rule = await this.prisma.automationRule.findFirst({ where: { id: ruleId, projectId } });
    if (!rule) throw new NotFoundException('Rule not found');
    await this.prisma.automationRule.delete({ where: { id: rule.id } });
    return { deleted: true };
  }

  // Called fire-and-forget from the write paths. Trigger bounds are enforced
  // here, not by callers: main branch only; translation.value only for
  // base-locale writes. Never throws.
  async fire(projectId: string, trigger: string, ctx: { keyId: string; keyName: string; branchName: string; localeCode?: string; actorId?: string }) {
    try {
      if (ctx.branchName !== 'main') return;
      const rules = await this.prisma.automationRule.findMany({ where: { projectId, trigger, enabled: true } });
      if (!rules.length) return;
      const project = await this.prisma.project.findUnique({ where: { id: projectId }, include: { locales: true } });
      if (!project) return;
      if (trigger === 'translation.value' && ctx.localeCode !== project.baseLocale) return;
      for (const rule of rules) {
        await this.runRule(projectId, project.baseLocale, rule, ctx).catch(() => {});
      }
    } catch { /* automation must never fail the triggering write */ }
  }

  private async runRule(projectId: string, baseLocale: string, rule: { id: string; name: string; action: string; config: Prisma.JsonValue; creatorId: string }, ctx: { keyId: string; keyName: string; actorId?: string }) {
    const config = (rule.config ?? {}) as Record<string, unknown>;
    let detail: Record<string, unknown>;
    try {
      if (rule.action === 'pretranslate') {
        const locales = (config.locales as string[]) ?? [];
        const results: Record<string, unknown> = {};
        for (const locale of locales) {
          try {
            results[locale] = await this.mt.pretranslate(rule.creatorId, projectId, {
              providerId: config.providerId as string, locale, keyIds: [ctx.keyId], branch: 'main',
            });
          } catch (e) {
            results[locale] = { error: e instanceof Error ? e.message : String(e) };
          }
        }
        detail = { rule: rule.name, action: rule.action, key: ctx.keyName, results };
      } else if (rule.action === 'notify') {
        // Local notification effect: dispatch the project's admin-managed
        // webhooks subscribed to automation.notify. The rule config names no
        // URL, so rule authors (admins) cannot aim the egress anywhere new;
        // delivery, signing, retry and journaling are the webhook pipeline's.
        const message = String(config.message ?? '').split('{key}').join(ctx.keyName);
        await this.webhooks.deliver(projectId, 'automation.notify', { keyId: ctx.keyId, key: ctx.keyName, message });
        detail = { rule: rule.name, action: rule.action, key: ctx.keyName, message };
      } else {
        const title = String(config.title ?? '').split('{key}').join(ctx.keyName);
        // Task-explosion bound, scoped honestly: one OPEN task per resolved
        // title. Atomic check-then-create: a per-(project,title) advisory
        // lock inside one transaction serializes concurrent fires, so two
        // simultaneous triggers cannot both create. Titles containing {key}
        // still create one task per distinct key (by design), and a task
        // leaving OPEN frees the title - this is not a global task cap.
        const assigneeId = (config.assigneeId as string) ?? undefined;
        const project = await this.projects.getFor(rule.creatorId, projectId);
        if (assigneeId) await this.tasks.assertAssigneeMember(project.teamId, assigneeId);
        const outcome = await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId + '::' + title}))`;
          const existing = await tx.task.findFirst({ where: { projectId, title, status: 'OPEN' } });
          if (existing) return { task: existing, deduplicated: true };
          return { task: await this.tasks.createIn(tx, rule.creatorId, projectId, { title, assigneeId }), deduplicated: false };
        });
        detail = {
          rule: rule.name, action: rule.action, key: ctx.keyName,
          taskId: outcome.task.id, title,
          ...(outcome.deduplicated ? { deduplicated: true } : {}),
        };
      }
    } catch (e) {
      detail = { rule: rule.name, action: rule.action, key: ctx.keyName, error: e instanceof Error ? e.message : String(e) };
    }
    // The run executes AS the creator (actorId = creator): creating a rule is
    // an admin-only act that delegates the creator's authority to the rule.
    // The creator's CURRENT grants are re-checked live inside mt.pretranslate
    // (assertLocaleWrite) and tasks.create (membership) on every run, so
    // demotion or a narrowed locale grant takes effect immediately. The
    // trigger actor only causes the run; they gain no access from it. Their
    // identity is recorded for audit.
    await this.prisma.$transaction(async (tx) => {
      await this.activity.record(tx, {
        projectId, actorId: rule.creatorId, action: 'automation.run', keyName: ctx.keyName,
        detail: { ...detail, triggeredBy: ctx.actorId ?? null, runAs: rule.creatorId } as Prisma.InputJsonValue,
      });
    });
  }
}
