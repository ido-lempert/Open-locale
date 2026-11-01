import type { Prisma } from '@prisma/client';
import { lockDeletionRecovery } from './deletion-recovery-lock';
import { rememberValueTx } from '../translations/remember-value';

// Isolated internal building block,no HTTP route. Caller owns explicit reviewed
// recovery intent and SAME Serializable transaction. No archived history replay,
// repository effect dispatch,baseline advance or remote write is implemented.
export async function writeDeletionRecovery(
  tx: Prisma.TransactionClient,
  scope: { projectId: string; actorId: string; auditId: string; expectedValueDigest: string },
) {
  const plan = await lockDeletionRecovery(tx, scope);
  const audit = await tx.translationDeletionAudit.findUniqueOrThrow({ where: { id: scope.auditId } });
  const snapshot = audit.snapshot as { row: { value: string } };
  // Create,never upsert:an existing/recreated locale value must not be overwritten.
  const row = await tx.translation.create({ data: {
    projectId: scope.projectId, keyId: plan.keyId!, localeCode: plan.locale!,
    value: snapshot.row.value, status: 'UNVERIFIED', version: 1,
    mtScore: null, mtProvider: null,
  } });
  const project = await tx.project.findUniqueOrThrow({ where: { id: scope.projectId }, select: { baseLocale: true } });
  await rememberValueTx(tx, scope.projectId, project.baseLocale, row.keyId, row.localeCode, row.value);
  await tx.translationHistory.create({ data: {
    keyId: row.keyId, localeCode: row.localeCode, value: row.value, previousValue: null,
    status: 'UNVERIFIED', changedById: scope.actorId,
  } });
  await tx.activityEvent.create({ data: {
    projectId: scope.projectId, actorId: scope.actorId, action: 'translation.value',
    keyName: audit.keyName, localeCode: row.localeCode,
    detail: { source: 'internal-deletion-recovery', auditId: audit.id, historyReplayed: false },
  } });
  // Restored presence invalidates old deletion generation;archive is retained.
  await tx.repositoryRemovalGeneration.delete({ where: {
    projectId_keyId_locale: { projectId: scope.projectId, keyId: row.keyId, locale: row.localeCode },
  } });
  return { restoredValues: 1, rowId: row.rowId, historyReplayed: false,
    repositoryEffectsCreated: false, remoteWritten: false, baselineAdvanced: false };
}
