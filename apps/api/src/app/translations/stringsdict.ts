// iOS .stringsdict interchange. Subset: one-level plural rules only -
// <key>name</key><dict><key>NSStringFormatSpecTypeKey</key>
// <string>NSStringPluralRuleType</string> plus CLDR category
// <key>cat</key><string>text</string> pairs. No width variants, no nested
// dicts, no DOCTYPE/entity declarations (rejected, consistent with the
// other XML formats; the emitter therefore omits the plist DOCTYPE so its
// own output re-imports). NSStringFormatValueTypeKey is accepted and
// ignored; emitted as "d" by convention.

const xmlEscape = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const xmlUnescape = (v: string) =>
  v.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Canonical CLDR category order for deterministic output.
const CLDR_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];
const KNOWN_KEYS = ['NSStringFormatSpecTypeKey', 'NSStringFormatValueTypeKey', ...CLDR_ORDER];

export function toStringsdict(plurals: [string, Record<string, string>][]): string {
  const entries = plurals.map(([name, forms]) => {
    const cats = CLDR_ORDER.filter((c) => c in forms)
      .map((c) => `      <key>${c}</key>\n      <string>${xmlEscape(forms[c])}</string>`)
      .join('\n');
    return `    <key>${xmlEscape(name)}</key>\n    <dict>\n` +
      `      <key>NSStringFormatSpecTypeKey</key>\n      <string>NSStringPluralRuleType</string>\n` +
      `      <key>NSStringFormatValueTypeKey</key>\n      <string>d</string>\n${cats}\n    </dict>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n${entries}\n</dict>\n</plist>\n`;
}

export function parseStringsdict(text: string): { plurals: [string, Record<string, string>][]; rejected: number } {
  const plurals: [string, Record<string, string>][] = [];
  let rejected = 0;
  if (!/<plist[\s>]/.test(text)) {
    // No <plist> root: not a stringsdict document. Reject instead of
    // silently importing zero keys (wrong-format file pick).
    return { plurals, rejected: 1 };
  }
  // DOCTYPE/entity declarations are unsupported (no XML parser is used, but
  // the rule stays consistent with the other XML formats).
  rejected += (text.match(/<!DOCTYPE/gi) ?? []).length + (text.match(/<!ENTITY/gi) ?? []).length;
  const spans: [number, number][] = [];
  const re = /<key>([^<]*)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    spans.push([m.index, m.index + m[0].length]);
    const inner = m[2];
    const spec = /<key>NSStringFormatSpecTypeKey<\/key>\s*<string>([^<]*)<\/string>/.exec(inner);
    if (!spec || spec[1] !== 'NSStringPluralRuleType') { rejected++; continue; }
    // Unknown keys inside an entry (width variants, nested specs) are
    // rejected, never silently dropped.
    let bad = false;
    const keyRe = /<key>([^<]*)<\/key>/g;
    let km: RegExpExecArray | null;
    while ((km = keyRe.exec(inner)) !== null) {
      if (!KNOWN_KEYS.includes(km[1])) { bad = true; break; }
    }
    const forms: Record<string, string> = {};
    let items = 0;
    if (!bad) {
      const catRe = /<key>(zero|one|two|few|many|other)<\/key>\s*<string>([\s\S]*?)<\/string>/g;
      let cm: RegExpExecArray | null;
      while ((cm = catRe.exec(inner)) !== null) {
        items++;
        if (forms[cm[1]] !== undefined || /<[a-zA-Z/]/.test(cm[2])) { bad = true; break; }
        forms[cm[1]] = xmlUnescape(cm[2]);
      }
    }
    if (bad || items === 0) { rejected++; continue; }
    plurals.push([xmlUnescape(m[1]), forms]);
  }
  // Fail-closed on entries the pattern could not parse at all: any <key>
  // left outside a matched entry span is an unparseable entry.
  let residual = text;
  for (const [a, b] of spans) residual = residual.slice(0, a) + ' '.repeat(b - a) + residual.slice(b);
  rejected += (residual.match(/<key>/g) ?? []).length;
  return { plurals, rejected };
}
