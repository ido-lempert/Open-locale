// Machine-translation provider drivers.
//
// The registry is the extension point: a driver translates a batch of source
// strings into a target locale. Only the built-in deterministic 'pseudo'
// driver ships today. External engines (Google, DeepL, ...) plug in here but
// are intentionally NOT implemented: they need credentials, network reach
// and explicit user authority, none of which exist yet.

export interface MtDriver {
  type: string;
  translate(texts: string[], sourceLocale: string, targetLocale: string, config: Record<string, unknown>): Promise<string[]>;
}

// Tokens that must survive translation untouched: ICU/printf placeholders and
// HTML-ish tags.
const PRESERVE = /(\{[^}]*\}|%[\d$]*[sdif]|%\([^)]+\)[sdif]|<[^>]+>)/g;

const ACCENT: Record<string, string> = {
  a: 'à', b: 'ƀ', c: 'ç', d: 'ð', e: 'è', f: 'ƒ', g: 'ğ', h: 'ħ', i: 'ì',
  j: 'ĵ', k: 'ķ', l: 'ľ', m: 'ɱ', n: 'ñ', o: 'ò', p: 'þ', q: 'ʠ', r: 'ŕ',
  s: 'š', t: 'ţ', u: 'ù', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'À', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'È', F: 'Ƒ', G: 'Ğ', H: 'Ħ', I: 'Ì',
  J: 'Ĵ', K: 'Ķ', L: 'Ľ', M: 'Ṁ', N: 'Ñ', O: 'Ò', P: 'Þ', Q: 'Ǫ', R: 'Ŕ',
  S: 'Š', T: 'Ţ', U: 'Ù', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
};

// Pseudo-localization: deterministic, offline, and useful in its own right
// for spotting hard-coded strings and layout breakage. It wraps the text in
// brackets, accents ASCII letters, and pads to ~140% length; placeholders and
// tags pass through untouched.
function pseudoOne(text: string, targetLocale: string): string {
  const parts = text.split(PRESERVE);
  const out = parts.map((part, i) => {
    if (i % 2 === 1) return part; // preserved token
    return part.replace(/[A-Za-z]/g, (ch) => ACCENT[ch] ?? ch);
  }).join('');
  const pad = '~'.repeat(Math.max(1, Math.round(out.length * 0.2)));
  return `[${out} ${pad}·${targetLocale}]`;
}

const pseudoDriver: MtDriver = {
  type: 'pseudo',
  async translate(texts, _sourceLocale, targetLocale) {
    return texts.map((t) => pseudoOne(t, targetLocale));
  },
};

const DRIVERS: Record<string, MtDriver> = { [pseudoDriver.type]: pseudoDriver };

export function driverFor(type: string): MtDriver | null {
  return DRIVERS[type] ?? null;
}

export function supportedTypes(): string[] {
  return Object.keys(DRIVERS);
}
