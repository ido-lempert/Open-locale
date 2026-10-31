import { randomUUID } from 'node:crypto';
import type { Prisma, RepositoryLocalEffectIntent } from '@prisma/client';

// Internal queue bookkeeping only. No worker or transport is enabled here.
// A lease is NOT authorization to deliver. Eventual handlers must validate current
// project/routing/authority and use the intent ID for downstream deduplication.
// Expired leases may have performed an effect before crashing: at-least-once,
// never an exactly-once guarantee. completed means handler bookkeeping, not receipt.
export async function claimRepositoryEffect(tx: Prisma.TransactionClient) {
  const token = randomUUID();
  const rows = await tx.$queryRaw<RepositoryLocalEffectIntent[]>`
    WITH candidate AS (
      SELECT id FROM repository_local_effect_intents
      WHERE (state='pending' AND "availableAt" <= clock_timestamp())
         OR (state='leased' AND "leaseUntil" <= clock_timestamp())
      ORDER BY "createdAt",id FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE repository_local_effect_intents AS intent SET
      state=CASE WHEN intent.attempts >= 3 THEN 'dead' ELSE 'leased' END,
      attempts=LEAST(intent.attempts+1,3),
      "leaseToken"=CASE WHEN intent.attempts >= 3 THEN NULL ELSE ${token}::uuid END,
      "leaseUntil"=CASE WHEN intent.attempts >= 3 THEN NULL ELSE clock_timestamp()+INTERVAL '60 seconds' END,
      "finishedAt"=CASE WHEN intent.attempts >= 3 THEN clock_timestamp() ELSE NULL END
    FROM candidate WHERE intent.id=candidate.id RETURNING intent.*`;
  // An exhausted candidate is retired in this bounded call, never handed to a
  // handler as executable work. A later claim can inspect the next candidate.
  return rows[0]?.state === 'leased' ? rows[0] : null;
}

// Fencing token AND unexpired database-clock deadline required. Old workers can
// neither finish nor requeue a reclaimed intent. No raw error/payload logs stored.
export async function settleRepositoryEffect(
  tx: Prisma.TransactionClient,
  id: string,
  token: string,
  outcome: 'completed' | 'retry',
) {
  if (!['completed', 'retry'].includes(outcome)) throw new Error('Invalid effect outcome');
  const rows = await tx.$queryRaw<{ id: string }[]>`
    UPDATE repository_local_effect_intents SET
      state=CASE WHEN ${outcome}='completed' THEN 'completed' WHEN attempts>=3 THEN 'dead' ELSE 'pending' END,
      "availableAt"=CASE WHEN ${outcome}='retry' THEN clock_timestamp()+INTERVAL '30 seconds'*attempts ELSE "availableAt" END,
      "finishedAt"=CASE WHEN ${outcome}='completed' OR attempts>=3 THEN clock_timestamp() ELSE NULL END,
      "leaseToken"=NULL,"leaseUntil"=NULL
    WHERE id=${id}::uuid AND state='leased' AND "leaseToken"=${token}::uuid
      AND "leaseUntil">clock_timestamp() RETURNING id`;
  return rows.length === 1;
}
