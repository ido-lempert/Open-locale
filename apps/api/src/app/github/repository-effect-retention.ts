import type { Prisma } from '@prisma/client';

// Internal bounded cleanup only, not a scheduled worker. Retain recent terminal
// bookkeeping for seven days. Pending/leased intents are never age-pruned, even
// when exhausted or expired: claim/settlement owns their state transitions.
// One call deletes at most100 rows; SKIP LOCKED lets concurrent cleanup/producers
// proceed without waiting on the same terminal rows. No payload is returned.
export async function pruneRepositoryEffects(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    WITH expired AS (
      SELECT id FROM repository_local_effect_intents
      WHERE state IN ('completed','dead')
        AND "finishedAt" < clock_timestamp()-INTERVAL '7 days'
      ORDER BY "finishedAt",id FOR UPDATE SKIP LOCKED LIMIT 100
    )
    DELETE FROM repository_local_effect_intents AS intent USING expired
    WHERE intent.id=expired.id RETURNING intent.id`;
  return { removed: rows.length };
}
