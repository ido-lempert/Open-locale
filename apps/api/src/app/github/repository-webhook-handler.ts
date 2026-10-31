import type { PrismaClient, RepositoryLocalEffectIntent } from '@prisma/client';
import type { WebhooksService } from '../webhooks/webhooks.service';
import { validateRepositoryEffect } from './repository-effect-eligibility';

// Internal handler adapter only, no enabled worker/public execution. Validate
// current scope immediately before invoking the existing current-subscription,
// signed, DNS-pinned webhook pipeline. No network under transaction locks.
// At-least-once: successful receivers may see retries when another receiver fails.
// Receivers must deduplicate by effectId. No automation handler in this stage.
export async function deliverRepositoryWebhook(
  db: PrismaClient,
  webhooks: Pick<WebhooksService, 'deliver'>,
  intent: RepositoryLocalEffectIntent,
) {
  const validate = () => db.$transaction(
    (tx) => validateRepositoryEffect(tx, intent.id, intent.leaseToken!),
    { isolationLevel: 'Serializable' },
  );
  const current = await validate();
  const result = await webhooks.deliver(
    current.projectId,
    current.operation === 'set-value' ? 'translation.updated' : 'translation.removed',
    { effectId: current.id, source: 'repository-local-write', key: current.keyName,
      locale: current.locale, operation: current.operation, value: current.value },
    async () => { await validate(); },
  );
  if (result.failed) throw new Error('Repository webhook delivery incomplete');
  return result;
}
