// Android strings.xml interchange. Subset: <string name="...">text</string> entries.
// Keys with dots are legal Android names, so mapping is 1:1.
// Escaping follows Android conventions: XML entities plus backslash-escaped quotes,
// newlines written as the two-character sequence \n.

const xmlEscape = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Attribute values additionally need quotes escaped, or a key containing '"'
// would break out of the attribute and produce malformed XML on export.
const xmlAttrEscape = (v: string) =>
  xmlEscape(v).replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function toAndroidXml(rows: [string, string][]): string {
  // Backslashes first: every later replacement introduces them, and a literal
  // backslash in the stored value must survive the roundtrip.
  const escValue = (v: string) =>
    xmlEscape(v.replace(/\\/g, '\\\\'))
      .replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  const body = rows
    .map(([k, v]) => `    <string name="${xmlAttrEscape(k)}">${escValue(v)}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${body}\n</resources>\n`;
}

const xmlUnescape = (v: string) =>
  v.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Sequential left-to-right scan: replace- chains get \\\\n (escaped backslash +
// 'n') wrong by turning it into a newline; the roundtrip must stay lossless.
const unescapeValue = (v: string) => {
  const s = xmlUnescape(v);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const c = s[++i];
      if (c === 'n') { out += '\n'; continue; }
      if (c === 't') { out += '\t'; continue; }
      if (c === "'") { out += "'"; continue; }
      if (c === '"') { out += '"'; continue; }
      if (c === '\\') { out += '\\'; continue; }
      out += '\\' + c; // unknown escape: keep both characters, never drop data
      continue;
    }
    out += s[i];
  }
  return out;
};

export function parseAndroidXml(text: string): { rows: [string, string][]; rejected: number } {
  const rows: [string, string][] = [];
  let rejected = 0;
  // Linear scan for <string name="...">...</string>; inner markup unsupported.
  const re = /<string\s+name="([^"]*)"\s*>([\s\S]*?)<\/string>/g;
  let m: RegExpExecArray | null;
  let matched = 0;
  while ((m = re.exec(text)) !== null) {
    matched++;
    if (/<[a-zA-Z/]/.test(m[2])) { rejected++; continue; } // inner markup unsupported
    rows.push([xmlUnescape(m[1]), unescapeValue(m[2])]);
  }
  // <string> elements the pattern could not parse at all (extra attributes, unclosed)
  const attempted = (text.match(/<string[\s>]/g) ?? []).length;
  rejected += Math.max(0, attempted - matched);
  // Unsupported constructs must never be silently dropped: plurals, string
  // arrays, and DOCTYPE/entity declarations are counted so the caller rejects
  // the import instead of reporting a false full success.
  for (const pat of [/<plurals[\s>]/g, /<string-array[\s>]/g, /<!DOCTYPE/gi, /<!ENTITY/gi]) {
    rejected += (text.match(pat) ?? []).length;
  }
  return { rows, rejected };
}
