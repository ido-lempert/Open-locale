import { rememberValueTx } from '../translations/remember-value';
import type { Prisma } from '@prisma/client';
import { lockLocalPreconditions } from './local-preconditions';
import type { LocalPreconditions } from './local-preconditions';
import type { LocalDraftChange } from './local-draft-plan';

// Isolated write building block, NOT a public apply service. Its eventual caller
// must authorize actor/target/baseline and bind reviewed draft in this same
// Serializable transaction. Existing-key locale sets/removals only. A removal
// archives the exact row and bounded history before the cascading row delete.
export async function writeExistingLocalValues(
  tx: Prisma.TransactionClient,
  expected: LocalPreconditions,
  changes: LocalDraftChange[],
  actorId: string,
) {
  await lockLocalPreconditions(tx, expected);
  if (
    !Array.isArray(changes) ||
    changes.length > 10000 ||
    new Set(changes.map((c) => c.key)).size !== changes.length
  )
    throw new Error('Invalid local value changes');
  const project = await tx.project.findUniqueOrThrow({
    where: { id: expected.projectId }, select: { baseLocale: true },
  });
  const byName = new Map(expected.keys.map((k) => [k.key, k]));
  // Validate the WHOLE batch before the first mutation, including later rows.
  for (const c of changes) {
    const key = byName.get(c.key);
    if (
      !key ||
      !['set-value', 'remove-locale-value'].includes(c.action) ||
      (c.action === 'set-value'
        ? typeof c.nextValue !== 'string'
        : c.nextValue !== null || !key.translation)
    )
      throw new Error('Invalid existing-key locale operation');
    if (
      (key.translation?.value ?? null) !== c.expectedValue ||
      c.nextValue === c.expectedValue
    )
      throw new Error('Local value change does not match reviewed snapshot');
    if (
      c.nextValue !== null &&
      key.maxLength !== null &&
      [...c.nextValue].length > key.maxLength
    )
      throw new Error('Draft locale value exceeds key length limit');
  }
  for (const c of changes) {
    const key = byName.get(c.key)!;
    if (c.action === 'remove-locale-value') {
      const row = await tx.translation.findUniqueOrThrow({
        where: {
          keyId_localeCode: { keyId: key.keyId, localeCode: expected.locale },
        },
      });
      const history = await tx.translationHistory.findMany({
        where: { keyId: key.keyId, localeCode: expected.locale },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 1001,
      });
      if (history.length > 1000)
        throw new Error('Deletion audit history exceeds bounds');
      const snapshot = JSON.parse(JSON.stringify({ row, history }));
      if (Buffer.byteLength(JSON.stringify(snapshot)) > 512 * 1024)
        throw new Error('Deletion audit bytes exceed bounds');
      await tx.translationDeletionAudit.create({
        data: {
          projectId: expected.projectId,
          keyId: key.keyId,
          keyName: key.key,
          localeCode: expected.locale,
          actorId,
          snapshot,
        },
      });
      await tx.translation.delete({
        where: {
          keyId_localeCode: { keyId: key.keyId, localeCode: expected.locale },
        },
      });
      await tx.activityEvent.create({
        data: {
          projectId: expected.projectId,
          actorId,
          action: 'translation.value',
          keyName: key.key,
          localeCode: expected.locale,
          detail: {
            source: 'internal-repository-local-write',
            operation: 'remove-locale-value',
            deletionAuditPreserved: true,
          },
        },
      });
      continue;
    }
    const data = {
      value: c.nextValue!,
      status: 'UNVERIFIED',
      mtScore: null,
      mtProvider: null,
    };
    await tx.translation.upsert({
      where: {
        keyId_localeCode: { keyId: key.keyId, localeCode: expected.locale },
      },
      create: {
        keyId: key.keyId,
        projectId: expected.projectId,
        localeCode: expected.locale,
        ...data,
        version: 1,
      },
      update: { ...data, version: { increment: 1 } },
    });
    await rememberValueTx(
      tx, expected.projectId, project.baseLocale, key.keyId, expected.locale, c.nextValue!,
    );
    await tx.translationHistory.create({
      data: {
        keyId: key.keyId,
        localeCode: expected.locale,
        value: c.nextValue!,
        previousValue: c.expectedValue,
        status: 'UNVERIFIED',
        changedById: actorId,
      },
    });
    await tx.activityEvent.create({
      data: {
        projectId: expected.projectId,
        actorId,
        action: 'translation.value',
        keyName: key.key,
        localeCode: expected.locale,
        detail: {
          source: 'internal-repository-local-write',
          previousValue: (c.expectedValue ?? '').slice(0, 200),
          value: c.nextValue!.slice(0, 200),
        },
      },
    });
  }
  return {
    updatedValues: changes.filter((c) => c.action === 'set-value').length,
    removedValues: changes.filter((c) => c.action === 'remove-locale-value')
      .length,
    createdKeys: 0,
    remoteWritten: false,
    baselineAdvanced: false,
  };
}
