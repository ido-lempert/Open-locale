import type { Prisma } from '@prisma/client';

// Internal bookkeeping only. Lock first so wait time cannot turn a deadline
// checked before contention into permission after expiry/reclaim.
export async function checkpointRepositoryChannel(
  tx: Prisma.TransactionClient, id: string, token: string,
  channel: 'webhook' | 'automation',
) {
  if (channel !== 'webhook' && channel !== 'automation') throw new Error('Invalid effect channel');
  await tx.$queryRaw`SELECT id FROM repository_local_effect_intents WHERE id=${id}::uuid FOR UPDATE`;
  // Literal statements keep identifiers out of dynamic SQL.
  const rows = channel === 'webhook'
    ? await tx.$queryRaw<{ id: string }[]>`
      UPDATE repository_local_effect_intents SET "webhookHandledAt"=clock_timestamp()
      WHERE id=${id}::uuid AND state='leased' AND "leaseToken"=${token}::uuid
        AND "leaseUntil">clock_timestamp() AND "webhookHandledAt" IS NULL RETURNING id`
    : await tx.$queryRaw<{ id: string }[]>`
      UPDATE repository_local_effect_intents SET "automationHandledAt"=clock_timestamp()
      WHERE id=${id}::uuid AND state='leased' AND "leaseToken"=${token}::uuid
        AND "leaseUntil">clock_timestamp() AND "automationHandledAt" IS NULL RETURNING id`;
  return rows.length === 1;
}
