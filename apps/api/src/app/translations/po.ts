// PO (gettext) interchange. Subset: plain msgid/msgstr entries plus a
// narrow plural subset. Keys map to msgids 1:1. The metadata header (empty
// msgid) is skipped as an entry but its Plural-Forms line is read for
// plural imports; obsolete entries (#~) are skipped silently; contexts
// (msgctxt) cannot roundtrip into flat keys and are rejected. Fuzzy flags
// are translator-workflow comments and import like any entry. Duplicate
// msgids collapse to the last occurrence (Object.fromEntries).
//
// Plural subset: an entry with msgid_plural and msgstr[0..n] slots (no
// plain msgstr) imports as a plural key. Slot indices are mapped to CLDR
// categories through an allowlist of reviewed standard gettext
// Plural-Forms headers (PO_IMPORT_PLURAL_HEADERS below): the file's header
// must match a listed expression exactly, modulo whitespace, and the
// reviewed slot->category mapping for that expression is used - the
// declared category order is never trusted and no untrusted C expression
// is ever evaluated on import. Headers not on the list - including the
// standard Russian/Polish rules, whose slots have no 'other' category -
// reject the import (400), fail-closed.
// msgid_plural is dropped on import (the key is the msgid; the source
// plural string is not stored - documented, lossy). Export emits
// msgid/msgid_plural/msgstr[n] for plural keys with stored forms, with
// msgid_plural repeated from the key name and a Plural-Forms header from
// a small curated expression table (verified against Intl.PluralRules in
// unit tests); slots whose category has no stored form export empty. A
// plural key in a locale outside the table falls back to a plain
// msgid/msgstr entry from value (documented, lossy for the plural intent).

const esc = (v: string) =>
  v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r');

// Curated Plural-Forms expressions for PO export. Every entry is
// verified against Intl.PluralRules in po.spec.ts: the expression must
// evaluate to a consistent slot->category map for n=0..200 that covers
// every slot AND every CLDR category of the locale, including 'other'
// (locales whose gettext slots have no 'other' category, e.g. Russian or
// Polish, are intentionally absent - their plural keys export as plain
// entries, documented above).
export const PO_PLURAL_FORMS: Record<string, string> = {
  en: 'nplurals=2; plural=(n != 1);',
  de: 'nplurals=2; plural=(n != 1);',
  nl: 'nplurals=2; plural=(n != 1);',
  sv: 'nplurals=2; plural=(n != 1);',
  da: 'nplurals=2; plural=(n != 1);',
  nb: 'nplurals=2; plural=(n != 1);',
  fi: 'nplurals=2; plural=(n != 1);',
  el: 'nplurals=2; plural=(n != 1);',
  et: 'nplurals=2; plural=(n != 1);',
  hu: 'nplurals=2; plural=(n != 1);',
  tr: 'nplurals=2; plural=(n != 1);',
  ja: 'nplurals=1; plural=0;',
  ko: 'nplurals=1; plural=0;',
  zh: 'nplurals=1; plural=0;',
  th: 'nplurals=1; plural=0;',
  vi: 'nplurals=1; plural=0;',
  id: 'nplurals=1; plural=0;',
  ms: 'nplurals=1; plural=0;',
  he: 'nplurals=3; plural=(n==1) ? 0 : (n==2) ? 1 : 2;',
  ar: 'nplurals=6; plural=(n==0) ? 0 : (n==1) ? 1 : (n==2) ? 2 : (n%100>=3 && n%100<=10) ? 3 : (n%100>=11) ? 4 : 5;',
  lv: 'nplurals=3; plural=(n%10==1 && n%100!=11) ? 0 : (n%10>=2 && (n%100<10 || n%100>=20)) ? 1 : 2;',
  ro: 'nplurals=3; plural=(n==1) ? 0 : (n==0 || (n%100>0 && n%100<20)) ? 1 : 2;',
  ga: 'nplurals=5; plural=(n==1) ? 0 : (n==2) ? 1 : (n>=3 && n<=6) ? 2 : (n>=7 && n<=10) ? 3 : 4;',
  sl: 'nplurals=4; plural=(n%100==1) ? 0 : (n%100==2) ? 1 : (n%100==3 || n%100==4) ? 2 : 3;',
};

// Canonical form of a Plural-Forms header for allowlist lookup. Whitespace
// is insignificant in the C expression grammar accepted here (no string
// literals, no identifiers other than n), so it is stripped entirely; the
// nplurals count is part of the key.
export function canonicalPluralKey(nplurals: number, expr: string): string {
  return `nplurals=${nplurals};plural=${expr.replace(/\s+/g, '')}`;
}

export interface PluralHeaderEntry {
  // Slot index -> CLDR category, reviewed from the documented standard
  // gettext header this exact expression implements.
  categories: string[];
  // Set when one expression is the documented standard header for several
  // locales with DIFFERENT slot meanings (the shared Latvian/Lithuanian
  // header); the import target locale picks the entry. Absent means the
  // mapping is the same for every locale that uses the header.
  locales?: string[];
}

// Import allowlist: the only Plural-Forms headers accepted for plural
// imports. Each entry is a reviewed, documented standard gettext header
// and is regression-checked against Intl.PluralRules in po.spec.ts;
// anything not listed - including arbitrary C expressions and headers
// whose slots have no 'other' category (Russian, Polish) - is rejected,
// fail-closed. Import needs only an 'other' slot to place every form
// correctly, so headers that do not cover every CLDR category of a locale
// (Czech, Slovak, Irish) are importable here even though the export table
// omits those locales: export must express every stored form, import must
// only avoid misplacing one.
export const PO_IMPORT_PLURAL_HEADERS: Record<string, PluralHeaderEntry[]> = {
  'nplurals=1;plural=0': [{ categories: ['other'] }],
  'nplurals=2;plural=(n!=1)': [{ categories: ['one', 'other'] }],
  'nplurals=2;plural=n!=1': [{ categories: ['one', 'other'] }],
  'nplurals=2;plural=(n>1)': [{ categories: ['one', 'other'] }],
  'nplurals=2;plural=n>1': [{ categories: ['one', 'other'] }],
  'nplurals=3;plural=(n==1)?0:(n==2)?1:2': [{ categories: ['one', 'two', 'other'] }],
  'nplurals=3;plural=(n==1)?0:(n>=2&&n<=4)?1:2': [{ categories: ['one', 'few', 'other'] }],
  'nplurals=3;plural=(n%10==1&&n%100!=11)?0:(n%10>=2&&(n%100<10||n%100>=20))?1:2': [
    { locales: ['lv'], categories: ['one', 'other', 'zero'] },
    { locales: ['lt'], categories: ['one', 'few', 'other'] },
  ],
  'nplurals=6;plural=(n==0)?0:(n==1)?1:(n==2)?2:(n%100>=3&&n%100<=10)?3:(n%100>=11)?4:5':
    [{ categories: ['zero', 'one', 'two', 'few', 'many', 'other'] }],
  'nplurals=3;plural=(n==1)?0:(n==0||(n%100>0&&n%100<20))?1:2': [{ categories: ['one', 'few', 'other'] }],
  'nplurals=5;plural=(n==1)?0:(n==2)?1:(n>=3&&n<=6)?2:(n>=7&&n<=10)?3:4':
    [{ categories: ['one', 'two', 'few', 'many', 'other'] }],
  'nplurals=4;plural=(n%100==1)?0:(n%100==2)?1:(n%100==3||n%100==4)?2:3':
    [{ categories: ['one', 'two', 'few', 'other'] }],
};

// Resolve an import header against the allowlist for a target locale.
// Fail-closed: unknown expressions and locale-ambiguous headers imported
// into a locale they do not cover both return an error string.
export function importSlotCategories(nplurals: number, expr: string, locale: string): { categories: string[] } | { error: string } {
  const entries = PO_IMPORT_PLURAL_HEADERS[canonicalPluralKey(nplurals, expr)];
  if (!entries) {
    return { error: `unsupported Plural-Forms expression (nplurals=${nplurals}; plural=${expr}); only reviewed standard headers are accepted` };
  }
  const entry = entries.find((e) => !e.locales || e.locales.includes(locale));
  if (!entry) {
    const locs = [...new Set(entries.flatMap((e) => e.locales ?? []))];
    return { error: `this Plural-Forms header has different slot meanings per locale and is supported only for: ${locs.join(', ')} (import target is ${locale})` };
  }
  return { categories: entry.categories };
}

// Evaluate a gettext plural C expression for a given n. Supports integer
// literals, n, %, *, / (truncating, like C), +, -, comparisons, !, &&, ||,
// ternary ?: and parentheses. Returns null for anything outside that
// grammar (fail-closed - the caller rejects the file).
export function evalPluralExpr(src: string, n: number): number | null {
  let i = 0;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const eat = (t: string) => { ws(); if (src.startsWith(t, i)) { i += t.length; return true; } return false; };
  const peek = (t: string) => { ws(); return src.startsWith(t, i); };
  function expr(): number | null {
    const c = orExpr();
    if (c === null) return null;
    if (eat('?')) {
      const a = expr();
      if (!eat(':')) return null;
      const b = expr();
      if (a === null || b === null) return null;
      return c !== 0 ? a : b;
    }
    return c;
  }
  function orExpr(): number | null {
    let l = andExpr();
    if (l === null) return null;
    while (peek('||')) { i += 2; const r = andExpr(); if (r === null) return null; l = l !== 0 || r !== 0 ? 1 : 0; }
    return l;
  }
  function andExpr(): number | null {
    let l = eqExpr();
    if (l === null) return null;
    while (peek('&&')) { i += 2; const r = eqExpr(); if (r === null) return null; l = l !== 0 && r !== 0 ? 1 : 0; }
    return l;
  }
  function eqExpr(): number | null {
    let l = relExpr();
    if (l === null) return null;
    for (;;) {
      if (eat('==')) { const r = relExpr(); if (r === null) return null; l = l === r ? 1 : 0; }
      else if (eat('!=')) { const r = relExpr(); if (r === null) return null; l = l !== r ? 1 : 0; }
      else return l;
    }
  }
  function relExpr(): number | null {
    let l = addExpr();
    if (l === null) return null;
    for (;;) {
      if (eat('<=')) { const r = addExpr(); if (r === null) return null; l = l <= r ? 1 : 0; }
      else if (eat('>=')) { const r = addExpr(); if (r === null) return null; l = l >= r ? 1 : 0; }
      else if (eat('<')) { const r = addExpr(); if (r === null) return null; l = l < r ? 1 : 0; }
      else if (eat('>')) { const r = addExpr(); if (r === null) return null; l = l > r ? 1 : 0; }
      else return l;
    }
  }
  function addExpr(): number | null {
    let l = mulExpr();
    if (l === null) return null;
    for (;;) {
      if (eat('+')) { const r = mulExpr(); if (r === null) return null; l += r; }
      else if (eat('-')) { const r = mulExpr(); if (r === null) return null; l -= r; }
      else return l;
    }
  }
  function mulExpr(): number | null {
    let l = unary();
    if (l === null) return null;
    for (;;) {
      if (eat('%')) { const r = unary(); if (r === null || r === 0) return null; l = l % r; }
      else if (eat('*')) { const r = unary(); if (r === null) return null; l *= r; }
      else if (eat('/')) { const r = unary(); if (r === null || r === 0) return null; l = Math.trunc(l / r); }
      else return l;
    }
  }
  function unary(): number | null {
    ws();
    if (eat('!')) { const v = unary(); return v === null ? null : v === 0 ? 1 : 0; }
    if (eat('-')) { const v = unary(); return v === null ? null : -v; }
    if (eat('(')) { const v = expr(); if (!eat(')')) return null; return v; }
    ws();
    const m = /^\d+/.exec(src.slice(i));
    if (m) { i += m[0].length; return parseInt(m[0], 10); }
    if (eat('n')) return n;
    return null;
  }
  const v = expr();
  ws();
  return i === src.length ? v : null;
}

// Parse "nplurals=2; plural=(n != 1);" into its two parts.
export function parsePluralFormsHeader(h: string): { nplurals: number; expr: string } | null {
  const np = /nplurals\s*=\s*(\d+)/.exec(h);
  const ex = /plural\s*=\s*([^;]+)/.exec(h);
  if (!np || !ex) return null;
  const nplurals = parseInt(np[1], 10);
  if (nplurals < 1 || nplurals > 6) return null;
  return { nplurals, expr: ex[1].trim() };
}

// Map gettext slot indices to CLDR categories by evaluating the expression
// for n=0..200 (two full mod-100 cycles) against Intl.PluralRules of the
// locale. Returns the per-slot category list, or null when the expression
// is unparseable, escapes its slot range, maps a slot to two categories or
// a category to two slots, or leaves a slot unused. Never trusts declared
// order - the mapping is derived, not read.
export function slotCategories(expr: string, nplurals: number, locale: string): string[] | null {
  const pr = new Intl.PluralRules(locale);
  const map: (string | null)[] = Array(nplurals).fill(null);
  for (let n = 0; n <= 200; n++) {
    const idx = evalPluralExpr(expr, n);
    if (idx === null || idx < 0 || idx >= nplurals || !Number.isInteger(idx)) return null;
    const cat = pr.select(n);
    if (map[idx] === null) map[idx] = cat;
    else if (map[idx] !== cat) return null;
  }
  if (map.some((c) => c === null)) return null;
  return map as string[];
}

// Slot categories for a curated export locale, or null when the locale has
// no verified table entry.
export function exportSlotCategories(locale: string): string[] | null {
  const h = PO_PLURAL_FORMS[locale];
  if (!h) return null;
  const parsed = parsePluralFormsHeader(h);
  if (!parsed) return null;
  return slotCategories(parsed.expr, parsed.nplurals, locale);
}

export function toPo(rows: [string, string][], plurals: [string, Record<string, string>][], locale?: string): string {
  const plain = rows.map(([k, v]) => `msgid "${esc(k)}"\nmsgstr "${esc(v)}"`);
  const slotCats = locale ? exportSlotCategories(locale) : null;
  const pl = slotCats
    ? plurals.map(([k, forms]) =>
        [`msgid "${esc(k)}"`, `msgid_plural "${esc(k)}"`,
         ...slotCats.map((c, i) => `msgstr[${i}] "${esc(forms[c] ?? '')}"`)].join('\n'))
    : [];
  const header = slotCats && pl.length > 0
    ? `msgid ""\nmsgstr "Content-Type: text/plain; charset=UTF-8\\n"\n"Plural-Forms: ${PO_PLURAL_FORMS[locale!]}\\n"\n\n`
    : '';
  const body = [...plain, ...pl].join('\n\n');
  return `# Exported from Open-locale.\n# Keys are msgids; context forms (msgctxt) are not used.\n\n${header}${body}\n`;
}

// POT (gettext template): same entry shape with every msgstr empty - a
// template translators fill in, not a translation delivery. Import accepts
// it through the same PO parser: msgids land as keys, empty msgstr values
// land as empty translations.
export function toPot(rows: [string, string][]): string {
  const body = rows.map(([k]) => `msgid "${esc(k)}"\nmsgstr ""`).join('\n\n');
  return `# Exported from Open-locale as a translation template (POT).\n# Keys are msgids; every msgstr is intentionally empty.\n\n${body}\n`;
}

// A PO string literal: double-quoted, with C-style escapes. Unknown escapes
// keep both characters - the roundtrip must stay lossless, never drop data.
const parseLiteral = (s: string): string | null => {
  const t = s.trim();
  if (t.length < 2 || !t.startsWith('"') || !t.endsWith('"')) return null;
  const inner = t.slice(1, -1);
  let out = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && i + 1 < inner.length) {
      const c = inner[++i];
      if (c === 'n') { out += '\n'; continue; }
      if (c === 't') { out += '\t'; continue; }
      if (c === 'r') { out += '\r'; continue; }
      if (c === '"') { out += '"'; continue; }
      if (c === '\\') { out += '\\'; continue; }
      out += '\\' + c;
      continue;
    }
    out += inner[i];
  }
  return out;
};

export function parsePo(text: string): {
  rows: [string, string][];
  pluralEntries: [string, Record<number, string>][];
  headerPluralForms: string | null;
  rejected: number;
} {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  const rows: [string, string][] = [];
  const pluralEntries: [string, Record<number, string>][] = [];
  let headerPluralForms: string | null = null;
  let rejected = 0;
  let msgid: string | null = null;
  let msgstr = '';
  let msgidPlural: string | null = null;
  let slots: Record<number, string> = {};
  let slotIdx = -1;
  let unsupported = false;
  let malformed = false;
  let obsolete = false;
  let field: 'none' | 'id' | 'str' | 'idp' | 'strN' = 'none';
  let started = false;

  const flush = () => {
    if (!started) return;
    if (obsolete) { /* commented-out entry: skip silently */ }
    else if (unsupported || malformed) rejected++;
    else if (msgid === '') {
      // Metadata header: skipped as an entry, but read for Plural-Forms.
      const m = /^Plural-Forms:\s*(.+)$/m.exec(msgstr);
      if (m) headerPluralForms = m[1].trim();
    } else if (msgid !== null) {
      if (msgidPlural !== null) {
        const idxs = Object.keys(slots).map(Number).sort((a, b) => a - b);
        // Slots must be consecutive from 0 (a gap means a missing msgstr[n]).
        if (idxs.length > 0 && idxs.every((v, i) => v === i)) {
          pluralEntries.push([msgid, slots]);
        } else {
          rejected++;
        }
      } else {
        rows.push([msgid, msgstr]);
      }
    }
    msgid = null; msgstr = ''; msgidPlural = null; slots = {}; slotIdx = -1;
    unsupported = false; malformed = false; obsolete = false; field = 'none'; started = false;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') { flush(); continue; }
    if (line.startsWith('#~')) { obsolete = true; started = true; continue; }
    if (line.startsWith('#')) { started = true; continue; }
    started = true;
    let v: string | null | undefined;
    if ((v = line.startsWith('msgid_plural') ? parseLiteral(line.slice('msgid_plural'.length)) : undefined) !== undefined) {
      if (v === null) malformed = true;
      else if (msgidPlural !== null || msgid === null) malformed = true; // duplicate or before msgid
      else msgidPlural = v;
      field = 'idp';
      continue;
    }
    if ((v = line.startsWith('msgctxt') ? parseLiteral(line.slice('msgctxt'.length)) : undefined) !== undefined) {
      unsupported = true; if (v === null) malformed = true; field = 'none'; continue;
    }
    if ((v = line.startsWith('msgid') ? parseLiteral(line.slice('msgid'.length)) : undefined) !== undefined) {
      if (v === null) malformed = true; else msgid = v; field = 'id'; continue;
    }
    const slotMatch = /^msgstr\[(\d+)\]/.exec(line);
    if (slotMatch) {
      const idx = parseInt(slotMatch[1], 10);
      const lit = parseLiteral(line.replace(/^msgstr\[\d+\]\s*/, ''));
      if (msgidPlural === null) { unsupported = true; field = 'none'; continue; } // msgstr[n] without msgid_plural
      if (lit === null) { malformed = true; field = 'none'; continue; }
      if (slots[idx] !== undefined) { malformed = true; field = 'none'; continue; } // duplicate slot
      slots[idx] = lit; slotIdx = idx; field = 'strN';
      continue;
    }
    if ((v = line.startsWith('msgstr') ? parseLiteral(line.slice('msgstr'.length)) : undefined) !== undefined) {
      if (v === null) malformed = true;
      else if (msgidPlural !== null) malformed = true; // plain msgstr mixed with msgstr[n]
      else msgstr = v;
      field = 'str';
      continue;
    }
    if (line.startsWith('"')) {
      const cont = parseLiteral(line);
      if (cont === null) { malformed = true; continue; }
      if (field === 'id' && msgid !== null) msgid += cont;
      else if (field === 'str') msgstr += cont;
      else if (field === 'idp' && msgidPlural !== null) msgidPlural += cont;
      else if (field === 'strN' && slotIdx >= 0) slots[slotIdx] += cont;
      else malformed = true;
      continue;
    }
    malformed = true;
  }
  flush();
  return { rows, pluralEntries, headerPluralForms, rejected };
}
