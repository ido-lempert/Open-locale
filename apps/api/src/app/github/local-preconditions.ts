import type { Prisma } from '@prisma/client';

export interface LocalPreconditions {
  projectId: string;
  branchId: string;
  branch: string;
  locale: string;
  keys: {
    keyId: string;
    key: string;
    keyUpdatedAt: string;
    maxLength: number | null;
    translation: { rowId: string; version: number; value: string } | null;
  }[];
  requiresExactKeySet: true;
  canApply: false;
}

// Internal transaction building block, never an HTTP caller's execution token.
// Caller must authorize, use SERIALIZABLE isolation, validate target/baseline and
// perform any eventual writes in this SAME transaction. Locked existing rows do
// not reserve absent rows; Serializable conflict handling remains mandatory.
export async function lockLocalPreconditions(
  tx: Prisma.TransactionClient,
  expected: LocalPreconditions,
) {
  if (
    !expected?.requiresExactKeySet ||
    expected.canApply !== false ||
    expected.keys.length > 10000
  )
    throw new Error('Invalid local snapshot preconditions');
  const isolation = await tx.$queryRaw<
    { transaction_isolation: string }[]
  >`SHOW transaction_isolation`;
  if (isolation[0]?.transaction_isolation !== 'serializable')
    throw new Error('Local precondition transaction must be serializable');
  const branch = await tx.branch.findFirst({
    where: {
      id: expected.branchId,
      projectId: expected.projectId,
      name: expected.branch,
    },
  });
  const locale = await tx.projectLocale.findUnique({
    where: {
      projectId_code: { projectId: expected.projectId, code: expected.locale },
    },
  });
  if (!branch || !locale) throw new Error('Local snapshot scope changed');
  const keys = await tx.$queryRaw<
    {
      id: string;
      name: string;
      updatedAt: Date;
      maxLength: number | null;
      isPlural: boolean;
    }[]
  >`
    SELECT id,name,"updatedAt","maxLength","isPlural" FROM keys
    WHERE "projectId"=${expected.projectId}::uuid AND "branchId"=${expected.branchId}::uuid ORDER BY name LIMIT 10001 FOR UPDATE`;
  if (keys.length !== expected.keys.length)
    throw new Error('Local snapshot key set changed');
  const translations = await tx.$queryRaw<
    {
      keyId: string;
      rowId: string;
      version: number;
      value: string;
      pluralForms: unknown;
    }[]
  >`
    SELECT t."keyId",t."rowId",t.version,t.value,t."pluralForms" FROM translations t JOIN keys k ON k.id=t."keyId"
    WHERE k."projectId"=${expected.projectId}::uuid AND k."branchId"=${expected.branchId}::uuid AND t."localeCode"=${expected.locale}
    ORDER BY k.name FOR UPDATE OF t`;
  const byKey = new Map(translations.map((t) => [t.keyId, t]));
  const byName = new Map(expected.keys.map((k) => [k.key, k]));
  if (byName.size !== expected.keys.length)
    throw new Error('Invalid local snapshot key set');
  for (const key of keys) {
    const e = byName.get(key.name),
      t = byKey.get(key.id);
    if (
      !e ||
      e.keyId !== key.id ||
      e.keyUpdatedAt !== key.updatedAt.toISOString() ||
      e.maxLength !== key.maxLength ||
      key.isPlural
    )
      throw new Error('Local snapshot key metadata changed');
    if (
      t?.pluralForms != null ||
      (e.translation === null
        ? !!t
        : !t ||
          e.translation.rowId !== t.rowId ||
          e.translation.version !== t.version ||
          e.translation.value !== t.value)
    )
      throw new Error('Local snapshot translation changed');
  }
  return {
    validatedKeys: keys.length,
    validatedValues: translations.length,
    canApply: false as const,
  };
}
