import type { PrismaClient, RepositoryLocalEffectIntent } from '@prisma/client';
import type { AutomationsService } from '../automations/automations.service';
import { runRepositoryEffect } from './repository-effect-runner';
import { fireRepositoryAutomation } from './repository-automation-handler';

// Internal explicitly invoked automation-only step. No timer/public route.
// Channel bookkeeping, not overall sync or webhook completion. Crash after an
// effect but before checkpoint may duplicate effects; no per-rule retry ledger.
export function runRepositoryAutomationStep(
  db: PrismaClient, automations: Pick<AutomationsService, 'fire'>,
) {
  return runRepositoryEffect(db, (intent) => handleRepositoryAutomationChannel(db, automations, intent));
}

// Shared with the explicit combined step; caller owns lease settlement.
export async function handleRepositoryAutomationChannel(
  db: PrismaClient, automations: Pick<AutomationsService, 'fire'>,
  intent: RepositoryLocalEffectIntent,
) {
  if (intent.automationHandledAt) return;
  await fireRepositoryAutomation(db, automations, intent);
  const handled = await db.$transaction((tx) => tx.$queryRaw<{ id: string }[]>`
    UPDATE repository_local_effect_intents SET "automationHandledAt"=clock_timestamp()
    WHERE id=${intent.id}::uuid AND state='leased'
      AND "leaseToken"=${intent.leaseToken}::uuid AND "leaseUntil">clock_timestamp()
      AND "automationHandledAt" IS NULL RETURNING id`);
  if (!handled.length) throw new Error('Repository automation checkpoint lease lost');

}
