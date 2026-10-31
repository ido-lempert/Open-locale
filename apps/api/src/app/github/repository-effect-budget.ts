import type { Prisma } from '@prisma/client';

// Internal composition-only admission check, after locked project scope and
// before writes in the SAME Serializable transaction. Not a global storage cap:
// terminal retention and database overhead are separate. Counts pending/leased
// including expired/exhausted work until its state is explicitly settled.
export async function assertRepositoryEffectBudget(
  tx: Prisma.TransactionClient,
  projectId: string,
  changes: { key: string; nextValue: string | null }[],
) {
  const isolation = await tx.$queryRaw<{ transaction_isolation: string }[]>`SHOW transaction_isolation`;
  if (isolation[0]?.transaction_isolation !== 'serializable') throw new Error('Effect budget requires serializable transaction');
  const project = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM projects WHERE id=${projectId}::uuid FOR UPDATE`;
  if (!project.length) throw new Error('Effect budget project unavailable');
  const budget = await tx.$queryRaw<{ count: bigint; bytes: bigint }[]>`
    SELECT count(*) AS count,
      COALESCE(sum(octet_length("keyName")+octet_length(COALESCE(value,''))),0)::bigint AS bytes
    FROM repository_local_effect_intents
    WHERE "projectId"=${projectId}::uuid AND state IN ('pending','leased')`;
  const addedBytes = changes.reduce((n, c) => n + Buffer.byteLength(c.key) + Buffer.byteLength(c.nextValue ?? ''), 0);
  if (BigInt(budget[0].count) + BigInt(changes.length) > 10000n ||
      BigInt(budget[0].bytes) + BigInt(addedBytes) > 8n * 1024n * 1024n)
    throw new Error('Repository pending effects exceed project backlog budget');
}
