import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { type DeletionRecoveryScope, lockDeletionRecovery } from './deletion-recovery-lock';
import { lockRepositoryWriteScope, type RepositoryWriteScope } from './repository-write-scope';
import { assertRepositoryEffectBudget } from './repository-effect-budget';
import { writeDeletionRecovery } from './deletion-recovery-writer';
import { RepositoryLocalError } from './repository-local-error';

// Isolated composition only. No HTTP caller, network delivery, fresh GitHub read,
// baseline advance or accepted synchronization. Caller owns explicit recovery
// review and SAME Serializable transaction. Repository guard currently requires
// direct team admin, even though isolated recovery also supports group admins.
export async function deletionRecoveryTransaction(
  tx: Prisma.TransactionClient,
  recovery: DeletionRecoveryScope,
  repository: RepositoryWriteScope,
) {
  recovery = { ...recovery };
  repository = { ...repository };
  if (recovery.projectId !== repository.projectId || recovery.actorId !== repository.actorId ||
      recovery.expectedBranchId !== repository.branchId)
    throw new RepositoryLocalError('conflict', 'Recovery repository scope mismatch');
  await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
  await lockRepositoryWriteScope(tx, repository);
  const plan = await lockDeletionRecovery(tx, recovery);
  if (plan.locale !== repository.locale)
    throw new RepositoryLocalError('conflict', 'Recovery repository locale mismatch');
  const branch = await tx.branch.findUniqueOrThrow({ where: { id: repository.branchId } });
  if (branch.name !== repository.branch)
    throw new RepositoryLocalError('conflict', 'Recovery repository branch changed');
  const audit = await tx.translationDeletionAudit.findUniqueOrThrow({ where: { id: recovery.auditId } });
  const value = (audit.snapshot as {row:{value:string}}).row.value;
  await assertRepositoryEffectBudget(tx, recovery.projectId, [{ key: audit.keyName, nextValue: value }]);
  const result = await writeDeletionRecovery(tx, recovery);
  const row = await tx.translation.findUniqueOrThrow({ where: { keyId_localeCode: { keyId: plan.keyId!, localeCode: plan.locale! } } });
  // Raw archived value digest and canonical recovery binding, NOT a repository
  // comparison preview. The intent schema stores generic digest lineage only.
  const binding = createHash('sha256').update(JSON.stringify([
    'deletion-recovery', recovery.projectId, recovery.actorId, recovery.auditId,
    recovery.expectedBranchId, recovery.expectedKeyUpdatedAt, recovery.expectedKeyRevision,
    recovery.expectedValueDigest, repository.targetId, repository.targetRevision,
    repository.baselineVersion, repository.baselineSha, repository.baselineDigest,
  ])).digest('hex');
  await tx.repositoryLocalEffectIntent.create({ data: {
    projectId: recovery.projectId, targetId: repository.targetId, actorId: recovery.actorId,
    keyId: row.keyId, keyName: audit.keyName, branchId: repository.branchId,
    branch: repository.branch, locale: row.localeCode, operation: 'set-value', value: row.value,
    targetRevision: repository.targetRevision, translationRowId: row.rowId,
    translationVersion: row.version, draftContentDigest: recovery.expectedValueDigest,
    previewFingerprint: binding,
  } });
  return { ...result, repositoryEffectsCreated: true, pendingEffectIntents: 1,
    source: 'internal-deletion-recovery-transaction' as const };
}
