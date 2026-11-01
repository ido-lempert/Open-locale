import type { PrismaClient, RepositoryLocalEffectIntent } from '@prisma/client';
import type { WebhooksService } from '../webhooks/webhooks.service';
import { runRepositoryEffect } from './repository-effect-runner';
import { deliverRepositoryWebhook } from './repository-webhook-handler';

// Internal, explicitly invoked single step. No startup timer or public route.
// Webhook channel only: does NOT mark automations or overall sync complete.
// Queue completed is handler bookkeeping, not a successful-sync/delivery receipt.
export function runRepositoryWebhookStep(
  db: PrismaClient, webhooks: Pick<WebhooksService, 'deliver'>,
) {
  return runRepositoryEffect(db, (intent) => handleRepositoryWebhookChannel(db, webhooks, intent));
}

// Shared with the explicit combined step; caller owns lease settlement.
export async function handleRepositoryWebhookChannel(
  db: PrismaClient, webhooks: Pick<WebhooksService, 'deliver'>,
  intent: RepositoryLocalEffectIntent,
) {
  // Independent channel checkpoint, not overall automation/sync completion.
  if (intent.webhookHandledAt) return;
  await deliverRepositoryWebhook(db, webhooks, intent);
  const handled = await db.$transaction((tx) => tx.$queryRaw<{ id: string }[]>`
    UPDATE repository_local_effect_intents SET "webhookHandledAt"=clock_timestamp()
    WHERE id=${intent.id}::uuid AND state='leased'
      AND "leaseToken"=${intent.leaseToken}::uuid AND "leaseUntil">clock_timestamp()
      AND "webhookHandledAt" IS NULL RETURNING id`);
  if (!handled.length) throw new Error('Repository webhook checkpoint lease lost');

}
