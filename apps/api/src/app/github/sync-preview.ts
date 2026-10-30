import { createHash } from 'node:crypto';

// Flat JSON string maps only. The planner has no I/O or permission to write.
// Caller must obtain current local values under project/locale authorization
// and current remote bytes through the contents adapter. Missing keys are
// represented distinctly from empty strings. No implicit delete or winner.
export type FlatStrings = Record<string, string>;
export type SyncDecision = {
  key: string;
  base: string | null;
  local: string | null;
  remote: string | null;
  kind: 'unchanged' | 'converged' | 'local-only' | 'remote-only' | 'conflict';
  suggested: 'none' | 'push' | 'pull' | 'manual';
};
const MAX_KEYS = 10_000,
  MAX_BYTES = 512 * 1024;
function assertMap(input: unknown): asserts input is FlatStrings {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    throw new Error('Expected a flat JSON string map');
  const entries = Object.entries(input);
  if (
    entries.length > MAX_KEYS ||
    Buffer.byteLength(JSON.stringify(input)) > MAX_BYTES
  )
    throw new Error('Sync map exceeds bounds');
  for (const [key, value] of entries) {
    if (
      !key ||
      key.length > 500 ||
      /[\x00-\x1f\x7f]/.test(key) ||
      ['__proto__', 'prototype', 'constructor'].includes(key) ||
      typeof value !== 'string'
    )
      throw new Error('Unsupported sync key or value');
  }
}
export function parseSyncJson(text: string): FlatStrings {
  if (Buffer.byteLength(text) > MAX_BYTES)
    throw new Error('Sync file exceeds bounds');
  // JSON.parse discards duplicate properties. Detect duplicates at the top
  // level before accepting, including escaped spellings of the same key.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Malformed sync JSON');
  }
  assertMap(parsed);
  const tokens =
    text.match(/"(?:[^"\\]|\\.)*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) ?? [];
  const seen = new Set<string>();
  for (let i = 1; i < tokens.length - 1; i += 4) {
    if (
      !tokens[i].startsWith('"') ||
      tokens[i + 1] !== ':' ||
      !tokens[i + 2]?.startsWith('"') ||
      (tokens[i + 3] !== ',' && tokens[i + 3] !== '}')
    )
      throw new Error('Expected flat string properties');
    const key = JSON.parse(tokens[i]) as string;
    if (seen.has(key)) throw new Error('Duplicate sync JSON key');
    seen.add(key);
  }
  return Object.assign(Object.create(null), parsed);
}
function value(map: FlatStrings, key: string): string | null {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
}
function canonical(map: FlatStrings) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
  );
}
export function previewSync(
  base: FlatStrings,
  local: FlatStrings,
  remote: FlatStrings,
  remoteSha: string,
) {
  [base, local, remote].forEach(assertMap);
  if (!/^[a-f0-9]{40}$/.test(remoteSha))
    throw new Error('Expected remote blob SHA');
  const keys = [
    ...new Set([
      ...Object.keys(base),
      ...Object.keys(local),
      ...Object.keys(remote),
    ]),
  ].sort();
  if (keys.length > MAX_KEYS) throw new Error('Sync union exceeds key bound');
  const decisions: SyncDecision[] = keys.map((key) => {
    const b = value(base, key),
      l = value(local, key),
      r = value(remote, key);
    const kind =
      l === b && r === b
        ? 'unchanged'
        : l === r
          ? 'converged'
          : r === b
            ? 'local-only'
            : l === b
              ? 'remote-only'
              : 'conflict';
    // Deletions are always manual: existing imports do not delete absent
    // keys, so do not advertise an automatic operation the app cannot apply.
    const suggested =
      kind === 'unchanged' || kind === 'converged'
        ? 'none'
        : kind === 'local-only' && l !== null
          ? 'push'
          : kind === 'remote-only' && r !== null
            ? 'pull'
            : 'manual';
    return {
      key,
      base: b,
      local: l,
      remote: r,
      kind,
      suggested,
    } as SyncDecision;
  });
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify([
        remoteSha,
        canonical(base),
        canonical(local),
        canonical(remote),
      ]),
    )
    .digest('hex');
  return {
    remoteSha,
    fingerprint,
    decisions,
    requiresManual: decisions.some((d) => d.suggested === 'manual'),
  };
}
