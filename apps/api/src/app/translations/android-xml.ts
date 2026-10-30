// Android strings.xml interchange. Subset: <string name="...">text</string> entries
// plus <plurals name="..."><item quantity="...">text</item></plurals> where quantity
// is one of the six CLDR categories (zero/one/two/few/many/other). Keys with dots
// are legal Android names, so mapping is 1:1. No string-array, no inner markup, no
// xliff namespace annotations.
// Escaping follows Android conventions: XML entities plus backslash-escaped quotes,
// newlines written as the two-character sequence \n.

const xmlEscape = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Attribute values additionally need quotes escaped, or a key containing '"'
// would break out of the attribute and produce malformed XML on export.
const xmlAttrEscape = (v: string) =>
  xmlEscape(v).replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Canonical CLDR category order for deterministic output.
const CLDR_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];

export function toAndroidXml(rows: [string, string][], plurals: [string, Record<string, string>][] = []): string {
  // Backslashes first: every later replacement introduces them, and a literal
  // backslash in the stored value must survive the roundtrip.
  const escValue = (v: string) =>
    xmlEscape(v.replace(/\\/g, '\\\\'))
      .replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  const body = rows
    .map(([k, v]) => `    <string name="${xmlAttrEscape(k)}">${escValue(v)}</string>`)
    .concat(plurals.map(([k, forms]) => {
      const items = CLDR_ORDER.filter((c) => c in forms)
        .map((c) => `        <item quantity="${c}">${escValue(forms[c])}</item>`)
        .join('\n');
      return `    <plurals name="${xmlAttrEscape(k)}">\n${items}\n    </plurals>`;
    }))
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

export function parseAndroidXml(text: string): { rows: [string, string][]; plurals: [string, Record<string, string>][]; rejected: number } {
  const rows: [string, string][] = [];
  const plurals: [string, Record<string, string>][] = [];
  let rejected = 0;
  if (!/<resources[\s>]/.test(text)) {
    // No <resources> root: not an Android strings document. Reject instead
    // of silently importing zero keys (wrong-format file pick).
    return { rows, plurals, rejected: 1 };
  }
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
  // <plurals name="..."><item quantity="cat">text</item>*</plurals>: quantity must
  // be a CLDR category, unique within the element; inner markup unsupported.
  const pre = /<plurals\s+name="([^"]*)"\s*>([\s\S]*?)<\/plurals>/g;
  let pm: RegExpExecArray | null;
  let pluralsMatched = 0;
  while ((pm = pre.exec(text)) !== null) {
    pluralsMatched++;
    const forms: Record<string, string> = {};
    let ok = true;
    let items = 0;
    const ire = /<item\s+quantity="([^"]*)"\s*>([\s\S]*?)<\/item>/g;
    let im: RegExpExecArray | null;
    while ((im = ire.exec(pm[2])) !== null) {
      items++;
      if (!CLDR_ORDER.includes(im[1]) || forms[im[1]] !== undefined || /<[a-zA-Z/]/.test(im[2])) { ok = false; break; }
      forms[im[1]] = unescapeValue(im[2]);
    }
    const attemptedItems = (pm[2].match(/<item[\s>]/g) ?? []).length;
    if (!ok || attemptedItems !== items || items === 0) { rejected++; continue; }
    plurals.push([xmlUnescape(pm[1]), forms]);
  }
  const attemptedPlurals = (text.match(/<plurals[\s>]/g) ?? []).length;
  rejected += Math.max(0, attemptedPlurals - pluralsMatched);
  // Unsupported constructs must never be silently dropped: string arrays and
  // DOCTYPE/entity declarations are counted so the caller rejects the import
  // instead of reporting a false full success.
  for (const pat of [/<string-array[\s>]/g, /<!DOCTYPE/gi, /<!ENTITY/gi]) {
    rejected += (text.match(pat) ?? []).length;
  }
  return { rows, plurals, rejected };
}
