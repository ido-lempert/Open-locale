import type { Prisma } from '@prisma/client';
import { lockLocalPreconditions } from './local-preconditions';
import type { LocalPreconditions } from './local-preconditions';
import type { LocalDraftChange } from './local-draft-plan';

// Isolated write building block, NOT a public apply service. Its eventual caller
// must authorize actor/target/baseline and bind reviewed draft in this same
// Serializable transaction. Only existing-key set operations supported here.
// Removing a translation cascades history today, so removal is refused until an
// explicit durable deletion-audit strategy is implemented. No hidden clear-to-''.
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
  const byName = new Map(expected.keys.map((k) => [k.key, k]));
  // Validate the WHOLE batch before the first mutation, including later rows.
  for (const c of changes) {
    const key = byName.get(c.key);
    if (!key || c.action !== 'set-value' || typeof c.nextValue !== 'string')
      throw new Error('Only existing-key locale value sets are supported');
    if (
      (key.translation?.value ?? null) !== c.expectedValue ||
      c.nextValue === c.expectedValue
    )
      throw new Error('Local value change does not match reviewed snapshot');
    if (key.maxLength !== null && [...c.nextValue].length > key.maxLength)
      throw new Error('Draft locale value exceeds key length limit');
  }
  for (const c of changes) {
    const key = byName.get(c.key)!;
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
    updatedValues: changes.length,
    removedValues: 0,
    createdKeys: 0,
    remoteWritten: false,
    baselineAdvanced: false,
  };
}
