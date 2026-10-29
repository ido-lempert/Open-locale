// Flutter ARB interchange. Subset: a single JSON object; keys not starting
// with '@' are translatable entries with string values. '@key' metadata
// objects are accepted and ignored (standard ARB resource attributes);
// '@@locale' is accepted and ignored (the target locale comes from the
// route). Rejected, never silently dropped: non-string entry values
// (numbers, booleans, null), nested objects/arrays as entry values, and
// ICU plural/select placeholders ({count, plural, ...} {...}) in values,
// which this app cannot represent. No placeholder metadata round-trip:
// export emits plain entries only.

export function toArb(rows: [string, string][], locale: string): string {
  const out: Record<string, string> = { '@@locale': locale } as Record<string, string>;
  for (const [k, v] of rows) out[k] = v;
  return JSON.stringify(out, null, 2) + '\n';
}

const ICU_COMPLEX_RE = /\{[^{}]*,\s*(plural|select|selectordinal)\s*,/;

export function parseArb(text: string): { rows: [string, string][]; rejected: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { rows: [], rejected: 1 };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { rows: [], rejected: 1 };
  }
  const rows: [string, string][] = [];
  let rejected = 0;
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (key.startsWith('@')) continue; // @@locale and @key metadata
    if (typeof value !== 'string') { rejected++; continue; }
    if (ICU_COMPLEX_RE.test(value)) { rejected++; continue; }
    rows.push([key, value]);
  }
  return { rows, rejected };
}
