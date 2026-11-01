import type { PrismaClient, RepositoryLocalEffectIntent } from '@prisma/client';
import type { AutomationsService } from '../automations/automations.service';
import { validateRepositoryEffect } from './repository-effect-eligibility';
import { checkpointRepositoryRule } from './repository-rule-checkpoint';

// Internal adapter only. No worker/public execution or channel checkpoint here.
// Existing automation service owns main/base-locale trigger bounds and current
// creator permissions. Empty set follows normal editing; removal does not invent
// a value-write trigger. Partial effects may happen before failed summary: retries
// require per-rule deduplication before enabling a production combined worker.
export async function fireRepositoryAutomation(
  db: PrismaClient,
  automations: Pick<AutomationsService, 'fire'>,
  intent: RepositoryLocalEffectIntent,
) {
  const revalidate = () => db.$transaction(
    (tx) => validateRepositoryEffect(tx, intent.id, intent.leaseToken!),
    { isolationLevel: 'Serializable' },
  );
  const current = await db.$transaction(async (tx) => {
    const checked = await validateRepositoryEffect(tx, intent.id, intent.leaseToken!);
    if (checked.operation !== 'set-value' || checked.automationRuleIds !== null) return checked;
    const rules = await tx.automationRule.findMany({
      where: { projectId: checked.projectId, trigger: 'translation.value', enabled: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true },
    });
    return tx.repositoryLocalEffectIntent.update({ where: { id: checked.id },
      data: { automationRuleIds: rules.map((rule) => rule.id) } });
  }, { isolationLevel: 'Serializable' });
  if (current.operation !== 'set-value')
    return { matched: 0, succeeded: 0, failed: 0, skipped: true };
  if (!Array.isArray(current.automationRuleIds) || !current.automationRuleIds.every((id) => typeof id === 'string'))
    throw new Error('Repository automation rule selection unavailable');
  const result = await automations.fire(current.projectId, 'translation.value', {
    keyId: current.keyId, keyName: current.keyName, branchName: current.branch,
    localeCode: current.locale, actorId: current.actorId,
  }, {
    ruleIds: current.automationRuleIds as string[],
    beforeRule: async () => { await revalidate(); },
    // Intent-scoped successful rule checkpoint. An edited rule does not replay
    // an already handled logical intent. Revision retained for audit only.
    ruleHandled: async (rule) => {
      const rows = await db.$queryRaw<{ ruleId: string }[]>`
        SELECT "ruleId" FROM repository_automation_rule_checkpoints
        WHERE "intentId"=${current.id}::uuid AND "ruleId"=${rule.id}::uuid`;
      return rows.length > 0;
    },
    afterRule: async (rule) => {
      const handled = await db.$transaction((tx) => checkpointRepositoryRule(
        tx, current.id, current.leaseToken!, rule,
      ));
      if (!handled) throw new Error('Repository automation rule checkpoint lease lost');
    },
  });
  if (result.failed) throw new Error('Repository automation run incomplete');
  return result;
}
