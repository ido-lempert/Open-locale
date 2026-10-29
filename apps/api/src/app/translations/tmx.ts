// TMX (Translation Memory eXchange) export. Export-only subset: TMX 1.4,
// one <tu> per memory entry pairing the base-locale source text with the
// target-locale text. Entries with empty targets never reach memory and are
// excluded here too. There is no TMX import. The header claims only what we
// emit; no external TMX consumer acceptance is asserted.

const xmlEscape = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const xmlAttrEscape = (v: string) =>
  xmlEscape(v).replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function toTmx(rows: [string, string][], srcLang: string, targetLang: string): string {
  const tus = rows
    .map(
      ([s, t]) =>
        `    <tu>\n` +
        `      <tuv xml:lang="${xmlAttrEscape(srcLang)}"><seg>${xmlEscape(s)}</seg></tuv>\n` +
        `      <tuv xml:lang="${xmlAttrEscape(targetLang)}"><seg>${xmlEscape(t)}</seg></tuv>\n` +
        `    </tu>`,
    )
    .join('\n');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<tmx version="1.4">\n` +
    `  <header creationtool="Open-locale" creationtoolversion="1.0" segtype="sentence" adminlang="en" srclang="${xmlAttrEscape(srcLang)}" datatype="PlainText"/>\n` +
    `  <body>\n${tus}\n  </body>\n</tmx>\n`
  );
}
