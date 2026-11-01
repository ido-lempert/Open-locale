import type { PrismaClient } from '@prisma/client';
import type { WebhooksService } from '../webhooks/webhooks.service';
import type { AutomationsService } from '../automations/automations.service';
import { runRepositoryEffect } from './repository-effect-runner';
import { handleRepositoryWebhookChannel } from './repository-webhook-step';
import { handleRepositoryAutomationChannel } from './repository-automation-step';

// Explicit internal invocation only. No production timer or public apply route.
// One lease, ordered independent checkpoints; completed is handler bookkeeping,
// not sync acceptance. Crash gaps/partial-rule retries can still duplicate effects.
export function runRepositoryEffectStep(
  db: PrismaClient, webhooks: Pick<WebhooksService, 'deliver'>,
  automations: Pick<AutomationsService, 'fire'>,
) {
  return runRepositoryEffect(db, async (intent) => {
    await handleRepositoryWebhookChannel(db, webhooks, intent);
    await handleRepositoryAutomationChannel(db, automations, intent);
  });
}
