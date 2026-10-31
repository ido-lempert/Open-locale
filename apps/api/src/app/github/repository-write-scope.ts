import type { Prisma } from '@prisma/client';
export interface RepositoryWriteScope {
  actorId: string;
  projectId: string;
  targetId: string;
  targetRevision: number;
  branchId: string;
  branch: string;
  locale: string;
  baselineVersion: number;
  baselineSha: string;
  baselineDigest: string;
}
// Internal transaction guard only. Not an HTTP grant or complete apply service.
// Call in the SAME Serializable transaction as local preconditions and writes.
export async function lockRepositoryWriteScope(
  tx: Prisma.TransactionClient,
  scope: RepositoryWriteScope,
) {
  const isolation = await tx.$queryRaw<
    { transaction_isolation: string }[]
  >`SHOW transaction_isolation`;
  if (isolation[0]?.transaction_isolation !== 'serializable')
    throw new Error('Repository write scope requires serializable transaction');
  const projects = await tx.$queryRaw<
    { teamId: string }[]
  >`SELECT "teamId" FROM projects WHERE id=${scope.projectId}::uuid FOR UPDATE`;
  if (!projects[0]) throw new Error('Repository write project unavailable');
  const members = await tx.$queryRaw<
    { role: string }[]
  >`SELECT role FROM team_members WHERE "teamId"=${projects[0].teamId}::uuid AND "userId"=${scope.actorId}::uuid FOR UPDATE`;
  if (!members[0] || !['OWNER', 'ADMIN'].includes(members[0].role))
    throw new Error('Repository write requires current project admin');
  const targets = await tx.$queryRaw<
    {
      revision: number;
      branchId: string;
      localBranch: string;
      locale: string;
    }[]
  >`SELECT revision,"branchId","localBranch",locale FROM repository_sync_targets WHERE id=${scope.targetId}::uuid AND "projectId"=${scope.projectId}::uuid FOR UPDATE`;
  const t = targets[0];
  if (
    !t ||
    t.revision !== scope.targetRevision ||
    t.branchId !== scope.branchId ||
    t.localBranch !== scope.branch ||
    t.locale !== scope.locale
  )
    throw new Error('Repository write target scope changed');
  const bases = await tx.$queryRaw<
    {
      version: number;
      targetRevision: number;
      remoteSha: string;
      contentDigest: string;
    }[]
  >`SELECT version,"targetRevision","remoteSha","contentDigest" FROM repository_sync_baselines WHERE "targetId"=${scope.targetId}::uuid FOR UPDATE`;
  const b = bases[0];
  if (
    !b ||
    b.version !== scope.baselineVersion ||
    b.targetRevision !== scope.targetRevision ||
    b.remoteSha !== scope.baselineSha ||
    b.contentDigest !== scope.baselineDigest
  )
    throw new Error('Repository write baseline changed');
  return {
    actorId: scope.actorId,
    projectId: scope.projectId,
    targetId: scope.targetId,
    adminValidated: true,
    canApply: false as const,
  };
}
