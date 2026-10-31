import type { PrismaClient, RepositoryLocalEffectIntent } from '@prisma/client';
import { claimRepositoryEffect, settleRepositoryEffect } from './repository-effect-lease';
import { validateRepositoryEffect } from './repository-effect-eligibility';

// Internal single-step runner only. No timer/startup registration or production
// handler here. Handler must perform current routing/authority checks and use
// intent.id for deduplication: validation is point-in-time, not a permanent grant.
// At-least-once only. Never call network handlers inside database transactions.
export async function runRepositoryEffect(
  db: PrismaClient,
  handler: (intent: RepositoryLocalEffectIntent) => Promise<void>,
) {
  const claimed = await db.$transaction(claimRepositoryEffect);
  if (!claimed) return { status: 'idle' as const };
  let intent: RepositoryLocalEffectIntent;
  try {
    intent = await db.$transaction(
      (tx) => validateRepositoryEffect(tx, claimed.id, claimed.leaseToken!),
      { isolationLevel: 'Serializable' },
    );
  } catch {
    // Revoked/superseded/temporarily unavailable scope is never delivered.
    // Bounded retry eventually retires it; no private error text is returned.
    const settled = await db.$transaction((tx) => settleRepositoryEffect(tx, claimed.id, claimed.leaseToken!, 'retry'));
    return { status: settled ? 'ineligible' as const : 'stale' as const };
  }
  let outcome: 'completed' | 'retry' = 'completed';
  try { await handler(intent); } catch { outcome = 'retry'; }
  const settled = await db.$transaction((tx) => settleRepositoryEffect(tx, claimed.id, claimed.leaseToken!, outcome));
  return { status: !settled ? 'stale' as const : outcome === 'completed' ? 'completed' as const : 'retry' as const };
}
