import { createHash } from 'node:crypto';
import { parseSyncJson } from './sync-preview';

export interface LocalDraftChange {
  key: string;
  action: 'set-value' | 'remove-locale-value';
  expectedValue: string | null;
  nextValue: string | null;
}

// Materialization only. Absence means removing one locale's value, NEVER a key
// or another locale. This plan is not an apply token and performs no writes.
export function localDraftPlan(
  decisions: { key: string; local: string | null }[],
  draftJson: string,
  previewFingerprint: string,
) {
  if (!/^[a-f0-9]{64}$/.test(previewFingerprint))
    throw new Error('Expected reviewed preview fingerprint');
  const draft = parseSyncJson(draftJson);
  const keys = new Set(decisions.map((d) => d.key));
  if (
    keys.size !== decisions.length ||
    Object.keys(draft).some((k) => !keys.has(k))
  )
    throw new Error('Draft keys must belong to the reviewed comparison');
  const changes: LocalDraftChange[] = [];
  for (const d of [...decisions].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  )) {
    const nextValue = Object.prototype.hasOwnProperty.call(draft, d.key)
      ? draft[d.key]
      : null;
    if (nextValue === d.local) continue;
    changes.push({
      key: d.key,
      action: nextValue === null ? 'remove-locale-value' : 'set-value',
      expectedValue: d.local,
      nextValue,
    });
  }
  return {
    source: 'local-draft-change-plan' as const,
    previewFingerprint,
    draftContentDigest: createHash('sha256').update(draftJson).digest('hex'),
    changes,
    setValues: changes.filter((c) => c.action === 'set-value').length,
    removeLocaleValues: changes.filter(
      (c) => c.action === 'remove-locale-value',
    ).length,
    unchangedValues: decisions.length - changes.length,
    deletesKeys: false as const,
    touchesOtherLocales: false as const,
    canApply: false as const,
  };
}
