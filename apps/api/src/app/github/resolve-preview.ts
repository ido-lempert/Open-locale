import { createHash } from 'node:crypto';
import { parseSyncJson, previewSync } from './sync-preview';

export type ResolutionChoice = 'base' | 'local' | 'remote';
export interface ResolutionInput {
  baselineJson: string;
  localJson: string;
  remoteJson: string;
  remoteSha: string;
  expectedFingerprint: string;
  choices: Record<string, ResolutionChoice>;
}

// Preparation only: explicit per-difference selection produces draft bytes.
// No repository/database writes, accepted baseline, permission or apply token.
export function resolvePreview(input: ResolutionInput) {
  const base = parseSyncJson(input.baselineJson);
  const local = parseSyncJson(input.localJson);
  const remote = parseSyncJson(input.remoteJson);
  const preview = previewSync(base, local, remote, input.remoteSha);
  return resolvePlan(preview, input.choices, input.expectedFingerprint);
}

export function resolvePlan(
  preview: ReturnType<typeof previewSync>,
  choices: Record<string, ResolutionChoice>,
  expectedFingerprint: string,
) {
  if (expectedFingerprint !== preview.fingerprint)
    throw new Error('Preview changed; review a fresh preview');
  if (
    !choices ||
    typeof choices !== 'object' ||
    Array.isArray(choices) ||
    ![null, Object.prototype].includes(Object.getPrototypeOf(choices))
  )
    throw new Error('Expected explicit resolution choices');
  const required = new Set(
    preview.decisions
      .filter((d) => d.kind !== 'unchanged' && d.kind !== 'converged')
      .map((d) => d.key),
  );
  const entries = Object.entries(choices);
  if (entries.length !== required.size)
    throw new Error('Choose exactly every differing key');
  for (const [key, choice] of entries) {
    if (!required.has(key) || !['base', 'local', 'remote'].includes(choice))
      throw new Error('Unsupported resolution choice');
  }
  const output: Record<string, string> = Object.create(null);
  let deleted = 0;
  for (const d of preview.decisions) {
    const choice = required.has(d.key) ? choices[d.key] : 'local';
    if (
      required.has(d.key) &&
      !Object.prototype.hasOwnProperty.call(choices, d.key)
    )
      throw new Error('Missing resolution choice');
    const selected = d[choice];
    // Selecting absence is explicit draft deletion, never an applied delete.
    if (selected === null) {
      deleted++;
      continue;
    }
    output[d.key] = selected;
  }
  const json = JSON.stringify(output, null, 2) + '\n';
  // Keep the same flat-map bounds for the combined result, not just inputs.
  parseSyncJson(json);
  return {
    json,
    previewFingerprint: preview.fingerprint,
    contentDigest: createHash('sha256').update(json).digest('hex'),
    explicitChoices: entries.length,
    outputKeys: Object.keys(output).length,
    absentKeys: deleted,
    source: 'explicit-preview-resolution' as const,
    baselineProvenanceVerified: false as const,
    canApply: false as const,
  };
}
