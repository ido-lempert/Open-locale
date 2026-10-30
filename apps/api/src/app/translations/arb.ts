// Flutter ARB interchange. Subset: a single JSON object; keys not starting
// with '@' are translatable entries with string values. '@key' metadata
// objects are accepted and ignored (standard ARB resource attributes);
// '@@locale' is accepted and ignored (the target locale comes from the
// route). Rejected, never silently dropped: non-string entry values
// (numbers, booleans, null), nested objects/arrays as entry values, and
// out-of-subset ICU messages. The supported ICU subset is a value that is
// exactly one plural message - {count, plural, one {...} other {...}} -
// with CLDR category selectors only, unique per message, no offset, no
// exact-value (=0) selectors, no nested braces; such a value imports as a
// plural key (isPlural upgrade, forms per category). ICU select and
// selectordinal, mixed text-plus-message values, and apostrophe-quoting
// other than '' '{' '} stay rejected. No placeholder metadata round-trip:
// the plural variable name is normalized to "count" on export (documented,
// lossy). Export escapes literal ' { } in forms with ICU quoting so its own
// output re-imports.

const CLDR_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];

const escIcu = (v: string) => v.replace(/'/g, "''").replace(/\{/g, "'{").replace(/\}/g, "'}");

export function toArb(rows: [string, string][], plurals: [string, Record<string, string>][], locale: string): string {
  const out: Record<string, string> = { '@@locale': locale } as Record<string, string>;
  for (const [k, v] of rows) out[k] = v;
  for (const [k, forms] of plurals) {
    const cats = CLDR_ORDER.filter((c) => c in forms)
      .map((c) => `${c} {${escIcu(forms[c])}}`)
      .join(' ');
    out[k] = `{count, plural, ${cats}}`;
  }
  return JSON.stringify(out, null, 2) + '\n';
}

// Parse a value that must be exactly one narrow ICU plural message.
// Returns the forms map, or null when the value is anything else (mixed
// text, select, offset, exact-value selectors, nested braces, unsupported
// quoting) - the caller then counts the entry as rejected.
function parsePluralMessage(v: string): Record<string, string> | null {
  const m = /^\{\s*[A-Za-z_][A-Za-z0-9_]*\s*,\s*plural\s*,\s*/.exec(v);
  if (!m || !v.endsWith('}')) return null;
  let i = m[0].length;
  const forms: Record<string, string> = {};
  while (i < v.length - 1) {
    const cm = /^(zero|one|two|few|many|other)\s*\{/.exec(v.slice(i, v.length - 1));
    if (!cm) return null;
    i += cm[0].length;
    let text = '';
    let closed = false;
    while (i < v.length) {
      const ch = v[i];
      if (ch === '}') { closed = true; i++; break; }
      if (ch === '{') return null; // nested message
      if (ch === "'") {
        const nx = v[i + 1];
        if (nx === "'") { text += "'"; i += 2; continue; }
        if (nx === '{' || nx === '}') { text += nx; i += 2; continue; }
        if (nx === '#' || nx === '|') return null; // unsupported quoting
        text += "'"; i++; continue; // lenient lone apostrophe, like ICU
      }
      text += ch; i++;
    }
    if (!closed) return null;
    if (forms[cm[1]] !== undefined) return null; // duplicate selector
    forms[cm[1]] = text;
    while (i < v.length - 1 && /\s/.test(v[i])) i++;
  }
  if (i !== v.length - 1) return null;
  return Object.keys(forms).length > 0 ? forms : null;
}

const ICU_COMPLEX_RE = /\{[^{}]*,\s*(plural|select|selectordinal)\s*,/;

export function parseArb(text: string): { rows: [string, string][]; plurals: [string, Record<string, string>][]; rejected: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { rows: [], plurals: [], rejected: 1 };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { rows: [], plurals: [], rejected: 1 };
  }
  const rows: [string, string][] = [];
  const plurals: [string, Record<string, string>][] = [];
  let rejected = 0;
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (key.startsWith('@')) continue; // @@locale and @key metadata
    if (typeof value !== 'string') { rejected++; continue; }
    if (ICU_COMPLEX_RE.test(value)) {
      const forms = parsePluralMessage(value);
      if (forms) {
        plurals.push([key, forms]);
        rows.push([key, forms.other ?? '']); // plain value carries the other form
      } else {
        rejected++;
      }
      continue;
    }
    rows.push([key, value]);
  }
  return { rows, plurals, rejected };
}
