import type { Prisma } from '@prisma/client';
import { inspectDeletionRecovery } from './deletion-recovery-plan';
import { RepositoryLocalError } from './repository-local-error';

// Internal guard only,no writer or HTTP grant. Any future write must remain in
// this SAME Serializable transaction and handle serialization failure,not retry
// stale authorization. Row locks do not reserve absent translation rows.
export async function lockDeletionRecovery(
  tx: Prisma.TransactionClient,
  scope: { projectId: string; actorId: string; auditId: string; expectedBranchId: string; expectedKeyUpdatedAt: string; expectedKeyRevision: number; expectedValueDigest: string },
) {
  const isolation = await tx.$queryRaw<{ transaction_isolation: string }[]>`SHOW transaction_isolation`;
  if (isolation[0]?.transaction_isolation !== 'serializable') throw new Error('Deletion recovery requires serializable transaction');
  if (!/^[a-f0-9]{64}$/.test(scope.expectedValueDigest)) throw new RepositoryLocalError('unsupported', 'Invalid recovery digest');
  if (!Number.isInteger(scope.expectedKeyRevision) || scope.expectedKeyRevision < 1 || scope.expectedKeyRevision > 2147483647) throw new RepositoryLocalError('unsupported', 'Invalid recovery key revision');
  await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
  const projects = await tx.$queryRaw<{ teamId: string }[]>`SELECT "teamId" FROM projects WHERE id=${scope.projectId}::uuid FOR UPDATE`;
  if (!projects[0]) throw new RepositoryLocalError('conflict', 'Recovery project unavailable');
  const members = await tx.$queryRaw<{ role: string }[]>`SELECT role FROM team_members WHERE "teamId"=${projects[0].teamId}::uuid AND "userId"=${scope.actorId}::uuid FOR UPDATE`;
  if (!members[0] || !['OWNER', 'ADMIN'].includes(members[0].role)) throw new RepositoryLocalError('conflict', 'Recovery requires current project admin');
  const audits = await tx.$queryRaw<{ keyId: string; localeCode: string }[]>`SELECT "keyId","localeCode" FROM translation_deletion_audits WHERE id=${scope.auditId}::uuid AND "projectId"=${scope.projectId}::uuid FOR UPDATE`;
  if (!audits[0]) throw new RepositoryLocalError('conflict', 'Recovery audit unavailable');
  const a = audits[0];
  const branches = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM branches WHERE id=${scope.expectedBranchId}::uuid AND "projectId"=${scope.projectId}::uuid FOR UPDATE`;
  if (!branches[0]) throw new RepositoryLocalError('conflict', 'Recovery branch unavailable');
  await tx.$queryRaw`SELECT id FROM keys WHERE id=${a.keyId}::uuid AND "projectId"=${scope.projectId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT code FROM project_locales WHERE "projectId"=${scope.projectId}::uuid AND code=${a.localeCode} FOR UPDATE`;
  await tx.$queryRaw`SELECT "auditId" FROM repository_removal_generations WHERE "projectId"=${scope.projectId}::uuid AND "keyId"=${a.keyId}::uuid AND locale=${a.localeCode} FOR UPDATE`;
  await tx.$queryRaw`SELECT "keyId" FROM translations WHERE "keyId"=${a.keyId}::uuid AND "localeCode"=${a.localeCode} FOR UPDATE`;
  const plan = await inspectDeletionRecovery(tx, scope.projectId, scope.auditId);
  if (!plan.eligible || !('valueDigest' in plan) || plan.valueDigest !== scope.expectedValueDigest || !('branchId' in plan) || plan.branchId !== scope.expectedBranchId || !('keyUpdatedAt' in plan) || plan.keyUpdatedAt !== scope.expectedKeyUpdatedAt || !('keyRevision' in plan) || plan.keyRevision !== scope.expectedKeyRevision) throw new RepositoryLocalError('conflict', 'Recovery candidate changed');
  return { ...plan, adminValidated: true as const, canRestore: false as const };
}
