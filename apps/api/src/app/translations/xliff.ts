// XLIFF 1.2 interchange. Subset: one <file>, flat <trans-unit> entries with
// <source> and <target>; the trans-unit id is the key. No <group> nesting,
// no inline markup (<g>, <x/>, <mrk>, <bpt>/<ept>), no <alt-trans> or
// <seg-source>: those constructs are rejected, never silently dropped.
// Units without a <target> are untranslated and skipped (not rejected):
// importing a source-only file must not wipe stored values.

const xmlEscape = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const xmlAttrEscape = (v: string) =>
  xmlEscape(v).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const xmlUnescape = (v: string) =>
  v.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export function toXliff(rows: [string, string][], sourceLanguage: string, targetLanguage: string): string {
  const units = rows
    .map(
      ([k, v]) =>
        `      <trans-unit id="${xmlAttrEscape(k)}">\n` +
        `        <source>${xmlEscape(v)}</source>\n` +
        `        <target>${xmlEscape(v)}</target>\n` +
        `      </trans-unit>`,
    )
    .join('\n');
  return (
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n` +
    `  <file source-language="${xmlAttrEscape(sourceLanguage)}" target-language="${xmlAttrEscape(targetLanguage)}" datatype="plaintext" original="open-locale">\n` +
    `    <body>\n${units}\n    </body>\n  </file>\n</xliff>\n`
  );
}

const UNIT_RE = /<trans-unit(?:\s+([^>]*))?>([\s\S]*?)<\/trans-unit>/g;
const ID_RE = /\bid="([^"]*)"/;
const SOURCE_RE = /<source>([\s\S]*?)<\/source>/;
const TARGET_RE = /<target\s*\/>|<target>([\s\S]*?)<\/target>/;
// Unsupported constructs that must never be dropped silently.
const UNSUPPORTED_UNIT_RE = /<(group|alt-trans|seg-source|bin-source|bin-target|mrk|g|x|bpt|ept|ph|it|sub|prop|note|context-group|count-group)\b/;
const INNER_MARKUP_RE = /<[a-zA-Z/]/;

export function parseXliff(text: string): { rows: [string, string][]; rejected: number; skipped: number } {
  const rows: [string, string][] = [];
  let rejected = 0;
  let skipped = 0;
  if (/<group[\s>]/.test(text)) {
    // Nested group structure anywhere in the file is unsupported.
    return { rows, rejected: 1, skipped: 0 };
  }
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = UNIT_RE.exec(text)) !== null) {
    const attrs = m[1] ?? '';
    const body = m[2];
    const idMatch = ID_RE.exec(attrs);
    if (!idMatch || idMatch[1] === '') { rejected++; continue; }
    const key = xmlUnescape(idMatch[1]);
    if (seen.has(key)) { rejected++; continue; }
    if (UNSUPPORTED_UNIT_RE.test(body)) { rejected++; continue; }
    const sourceMatch = SOURCE_RE.exec(body);
    if (!sourceMatch || INNER_MARKUP_RE.test(sourceMatch[1])) { rejected++; continue; }
    const targetMatch = TARGET_RE.exec(body);
    if (!targetMatch) { skipped++; continue; } // untranslated unit
    const target = targetMatch[1] ?? '';
    if (INNER_MARKUP_RE.test(target)) { rejected++; continue; }
    seen.add(key);
    rows.push([key, xmlUnescape(target)]);
  }
  return { rows, rejected, skipped };
}
