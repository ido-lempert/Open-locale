import type { PrismaClient, RepositoryLocalEffectIntent } from '@prisma/client';
import type { AutomationsService } from '../automations/automations.service';
import { validateRepositoryEffect } from './repository-effect-eligibility';

// Internal adapter only. No worker/public execution or channel checkpoint here.
// Existing automation service owns main/base-locale trigger bounds and current
// creator permissions. Empty set follows normal editing; removal does not invent
// a value-write trigger. Partial effects may happen before failed summary: retries
// require per-rule deduplication before enabling a production combined worker.
export async function fireRepositoryAutomation(
  db: PrismaClient,
  automations: Pick<AutomationsService, 'fire'>,
  intent: RepositoryLocalEffectIntent,
) {
  const current = await db.$transaction(
    (tx) => validateRepositoryEffect(tx, intent.id, intent.leaseToken!),
    { isolationLevel: 'Serializable' },
  );
  if (current.operation !== 'set-value')
    return { matched: 0, succeeded: 0, failed: 0, skipped: true };
  const result = await automations.fire(current.projectId, 'translation.value', {
    keyId: current.keyId, keyName: current.keyName, branchName: current.branch,
    localeCode: current.locale, actorId: current.actorId,
  });
  if (result.failed) throw new Error('Repository automation run incomplete');
  return result;
}
