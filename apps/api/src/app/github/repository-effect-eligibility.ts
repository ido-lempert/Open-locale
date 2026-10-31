import type { Prisma } from '@prisma/client';

// Internal pre-dispatch guard, NOT a transport, lease renewal or permanent grant.
// Requires same short Serializable transaction as queue bookkeeping. Never hold
// these locks during network delivery; later changes and crash/retry races still
// require handler-side current routing checks and downstream intent deduplication.
export async function validateRepositoryEffect(
  tx: Prisma.TransactionClient, id: string, token: string,
) {
  const isolation = await tx.$queryRaw<{ transaction_isolation: string }[]>`SHOW transaction_isolation`;
  if (isolation[0]?.transaction_isolation !== 'serializable') throw new Error('Effect eligibility requires serializable transaction');
  const intents = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM repository_local_effect_intents WHERE id=${id}::uuid
    AND state='leased' AND "leaseToken"=${token}::uuid AND "leaseUntil">clock_timestamp() FOR UPDATE`;
  if (!intents.length) throw new Error('Effect lease unavailable');
  const intent = await tx.repositoryLocalEffectIntent.findUniqueOrThrow({ where: { id } });
  if (intent.targetRevision === null) throw new Error('Effect generation evidence unavailable');
  const projects = await tx.$queryRaw<{ teamId: string }[]>`SELECT "teamId" FROM projects WHERE id=${intent.projectId}::uuid FOR UPDATE`;
  if (!projects[0]) throw new Error('Effect project unavailable');
  const members = await tx.$queryRaw<{ role: string }[]>`SELECT role FROM team_members WHERE "teamId"=${projects[0].teamId}::uuid AND "userId"=${intent.actorId}::uuid FOR UPDATE`;
  if (!members[0] || !['OWNER','ADMIN'].includes(members[0].role)) throw new Error('Effect actor no longer admin');
  await tx.$queryRaw`SELECT id FROM repository_sync_targets WHERE id=${intent.targetId}::uuid FOR UPDATE`;
  const target = await tx.repositorySyncTarget.findUnique({ where: { id: intent.targetId } });
  if (!target || target.projectId !== intent.projectId || target.revision !== intent.targetRevision || target.branchId !== intent.branchId || target.localBranch !== intent.branch || target.locale !== intent.locale) throw new Error('Effect target changed');
  await tx.$queryRaw`SELECT id FROM keys WHERE id=${intent.keyId}::uuid FOR UPDATE`;
  const key = await tx.key.findUnique({ where: { id: intent.keyId }, include: { branch: true } });
  if (!key || key.projectId !== intent.projectId || key.branchId !== intent.branchId || key.branch.name !== intent.branch || key.name !== intent.keyName || key.isPlural) throw new Error('Effect key lineage changed');
  const locale = await tx.projectLocale.findUnique({ where: { projectId_code: { projectId: intent.projectId, code: intent.locale } } });
  if (!locale) throw new Error('Effect locale unavailable');
  await tx.$queryRaw`SELECT "rowId" FROM translations WHERE "keyId"=${intent.keyId}::uuid AND "localeCode"=${intent.locale} FOR UPDATE`;
  const row = await tx.translation.findUnique({ where: { keyId_localeCode: { keyId: intent.keyId, localeCode: intent.locale } } });
  if (intent.operation === 'set-value') {
    if (!row || !intent.translationRowId || row.rowId !== intent.translationRowId || row.version !== intent.translationVersion || row.value !== intent.value) throw new Error('Effect locale generation changed');
  } else if (intent.operation !== 'remove-locale-value' || row || intent.value !== null || intent.translationRowId !== null || intent.translationVersion !== null) throw new Error('Effect removal superseded');
  // Lock waits may consume the lease. Re-check database wall clock after ALL
  // scope checks so a worker cannot leave this guard with an expired token.
  const live = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM repository_local_effect_intents WHERE id=${id}::uuid AND "leaseUntil">clock_timestamp()`;
  if (!live.length) throw new Error('Effect lease expired during validation');
  return intent;
}
