// Android strings.xml interchange. Subset: <string name="...">text</string> entries.
// Keys with dots are legal Android names, so mapping is 1:1.
// Escaping follows Android conventions: XML entities plus backslash-escaped quotes,
// newlines written as the two-character sequence \n.

const xmlEscape = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function toAndroidXml(rows: [string, string][]): string {
  const escValue = (v: string) =>
    xmlEscape(v).replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  const body = rows
    .map(([k, v]) => `    <string name="${xmlEscape(k)}">${escValue(v)}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${body}\n</resources>\n`;
}

const xmlUnescape = (v: string) =>
  v.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const unescapeValue = (v: string) =>
  xmlUnescape(v).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\'/g, "'").replace(/\\"/g, '"');

export function parseAndroidXml(text: string): { rows: [string, string][]; rejected: number } {
  const rows: [string, string][] = [];
  let rejected = 0;
  // Linear scan for <string name="...">...</string>; inner markup unsupported.
  const re = /<string\s+name="([^"]*)"\s*>([\s\S]*?)<\/string>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (/<[a-zA-Z/]/.test(m[2])) { rejected++; continue; }
    rows.push([xmlUnescape(m[1]), unescapeValue(m[2])]);
  }
  // <string> elements the pattern could not parse at all (bad attributes, unclosed)
  const attempted = (text.match(/<string[\s>]/g) ?? []).length;
  rejected = Math.max(rejected, attempted - rows.length);
  return { rows, rejected };
}
