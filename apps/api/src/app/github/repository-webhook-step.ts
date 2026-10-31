import type { PrismaClient } from '@prisma/client';
import type { WebhooksService } from '../webhooks/webhooks.service';
import { runRepositoryEffect } from './repository-effect-runner';
import { deliverRepositoryWebhook } from './repository-webhook-handler';

// Internal, explicitly invoked single step. No startup timer or public route.
// Webhook channel only: does NOT mark automations or overall sync complete.
// Queue completed is handler bookkeeping, not a successful-sync/delivery receipt.
export function runRepositoryWebhookStep(
  db: PrismaClient, webhooks: Pick<WebhooksService, 'deliver'>,
) {
  return runRepositoryEffect(db, async (intent) => {
    await deliverRepositoryWebhook(db, webhooks, intent);
  });
}
