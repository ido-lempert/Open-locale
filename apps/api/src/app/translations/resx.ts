// RESX (.NET XML resources) interchange. Subset: one <root>, flat <data>
// entries with a name attribute and a <value> child. <resheader> rows are
// emitted on export for tool compatibility and ignored on import, as are
// <comment> children: neither survives a round trip, and that is explicit.
// Typed or binary resources (type/mimetype attributes), <metadata> sections,
// assembly references and inner markup inside <value> are rejected, never
// silently dropped. The reader is a lexical scan, not an XML parser: it has
// no DTD or entity processing at all, so anything that would require it is
// rejected fail-closed rather than resolved or left literal: any DOCTYPE or
// ENTITY declaration rejects the whole document, and any entity reference
// beyond the five predefined XML ones (including numeric character
// references) rejects the entry. No external resolution is possible.
// Whitespace inside <value> is preserved verbatim on import regardless of
// xml:space, and export always emits xml:space="preserve" so the round trip
// keeps it.

const xmlEscape = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const xmlAttrEscape = (v: string) =>
  xmlEscape(v).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const xmlUnescape = (v: string) =>
  v.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export function toResx(rows: [string, string][]): string {
  const data = rows
    .map(
      ([k, v]) =>
        `  <data name="${xmlAttrEscape(k)}" xml:space="preserve">\n` +
        `    <value>${xmlEscape(v)}</value>\n  </data>`,
    )
    .join('\n');
  return (
    `<?xml version="1.0" encoding="utf-8"?>\n<root>\n` +
    `  <resheader name="resmimetype"><value>text/microsoft-resx</value></resheader>\n` +
    `  <resheader name="version"><value>2.0</value></resheader>\n` +
    `  <resheader name="reader"><value>System.Resources.ResXResourceReader, System.Windows.Forms</value></resheader>\n` +
    `  <resheader name="writer"><value>System.Resources.ResXResourceWriter, System.Windows.Forms</value></resheader>\n` +
    `${data}\n</root>\n`
  );
}

const DATA_RE = /<data(?:\s+([^>]*?))?(?:\/>|>([\s\S]*?)<\/data>)/g;
const NAME_RE = /\bname="([^"]*)"/;
const TYPED_RE = /\b(type|mimetype)="[^"]*"/;
const VALUE_RE = /<value(?:\s[^>]*)?\/>|<value(?:\s[^>]*)?>([\s\S]*?)<\/value>/;
const INNER_MARKUP_RE = /<[a-zA-Z/]/;

export function parseResx(text: string): { rows: [string, string][]; rejected: number } {
  const rows: [string, string][] = [];
  let rejected = 0;
  const unknownEntity = (raw: string) => /&(?!amp;|lt;|gt;|quot;|apos;)/.test(raw);
  const rootMatch = /<root(\s[^>]*)?>/.exec(text);
  if (!rootMatch) {
    // No RESX root element: not a RESX document at all. Reject instead of
    // silently importing zero keys (wrong-format file pick).
    return { rows, rejected: 1 };
  }
  if (/\bxmlns[:=]/.test(rootMatch[1] ?? '')) {
    // Namespaced root: outside the subset. Reject rather than guess at
    // namespace semantics we do not implement.
    return { rows, rejected: 1 };
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
    // DTDs are outside the subset and would change parsing semantics (entity
    // expansion, external resolution): reject the document outright.
    return { rows, rejected: 1 };
  }
  if (/<metadata[\s>]|<assembly[\s>]/.test(text)) {
    // <metadata> sections and assembly aliases are outside the subset.
    return { rows, rejected: 1 };
  }
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = DATA_RE.exec(text)) !== null) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    const nameMatch = NAME_RE.exec(attrs);
    if (!nameMatch || nameMatch[1] === '') { rejected++; continue; }
    if (unknownEntity(nameMatch[1])) { rejected++; continue; } // unresolvable entity in name
    if (TYPED_RE.test(attrs)) { rejected++; continue; } // typed/binary resource
    const key = xmlUnescape(nameMatch[1]);
    if (seen.has(key)) { rejected++; continue; }
    const valueMatch = VALUE_RE.exec(body);
    if (!valueMatch) { rejected++; continue; }
    const value = valueMatch[1] ?? '';
    if (unknownEntity(value)) { rejected++; continue; } // unresolvable entity reference
    if (INNER_MARKUP_RE.test(value)) { rejected++; continue; }
    seen.add(key);
    rows.push([key, xmlUnescape(value)]);
  }
  return { rows, rejected };
}
