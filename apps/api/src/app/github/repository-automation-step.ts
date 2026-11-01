import type { PrismaClient, RepositoryLocalEffectIntent } from '@prisma/client';
import type { AutomationsService } from '../automations/automations.service';
import { runRepositoryEffect } from './repository-effect-runner';
import { fireRepositoryAutomation } from './repository-automation-handler';

import { checkpointRepositoryChannel } from './repository-channel-checkpoint';

// Internal explicitly invoked automation-only step. No timer/public route.
// Channel bookkeeping, not overall sync or webhook completion. Crash after an
// effect but before checkpoint may duplicate effects; successful-rule ledger does not close that crash gap.
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
  const handled = await db.$transaction((tx) => checkpointRepositoryChannel(
    tx, intent.id, intent.leaseToken!, 'automation',
  ));
  if (!handled) throw new Error('Repository automation checkpoint lease lost');
}
