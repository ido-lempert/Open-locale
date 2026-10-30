import { canonicalPluralKey, evalPluralExpr, importSlotCategories, parsePluralFormsHeader, parsePo, PO_IMPORT_PLURAL_HEADERS, PO_PLURAL_FORMS, slotCategories, toPo, toPot } from './po';

  it('exports a POT template with every msgstr empty', () => {
    const out = toPot([['app.title', 'Hello'], ['cart.total', 'Total {n}']]);
    expect(out).toContain('# Exported from Open-locale as a translation template (POT).');
    expect(out).toContain('msgid "app.title"\nmsgstr ""');
    expect(out).toContain('msgid "cart.total"\nmsgstr ""');
    expect(out).not.toContain('msgstr "Hello"');
  });

  it('imports a POT through the PO parser: keys land with empty values', () => {
    const pot = toPot([['a.b', 'ignored'], ['c.d', 'x']]);
    const back = parsePo(pot);
    expect(back.rejected).toBe(0);
    expect(back.rows).toEqual([['a.b', ''], ['c.d', '']]);
  });

describe('PO interchange', () => {
  it('exports entries with escaped quotes, newlines, tabs and backslashes', () => {
    const out = toPo([['app.title', 'My "App"'], ['msg.multi', 'line1\nline2'], ['msg.tab', 'a\tb'], ['msg.bs', 'c:\\path']], []);
    expect(out).toContain('msgid "app.title"\nmsgstr "My \\"App\\""');
    expect(out).toContain('msgstr "line1\\nline2"');
    expect(out).toContain('msgstr "a\\tb"');
    expect(out).toContain('msgstr "c:\\\\path"');
  });

  it('roundtrips losslessly', () => {
    const rows: [string, string][] = [
      ['home.title', 'Welcome "home"'],
      ['msg.multi', 'line1\nline2'],
      ['unicode', 'שלום 🌍'],
      ['empty', ''],
    ];
    const back = parsePo(toPo(rows, []));
    expect(back.rejected).toBe(0);
    expect(back.rows).toEqual(rows);
  });

  it('parses multiline adjacent strings and skips comments', () => {
    const text = '# translator note\n#: reference.ts:12\n#, fuzzy\nmsgid "multi."\n"key"\nmsgstr "part1 "\n"part2"\n';
    const { rows, rejected } = parsePo(text);
    expect(rejected).toBe(0);
    expect(rows).toEqual([['multi.key', 'part1 part2']]);
  });

  it('skips the metadata header and obsolete entries silently', () => {
    const text = 'msgid ""\nmsgstr "Content-Type: text/plain; charset=UTF-8"\n\n#~ msgid "old.key"\n#~ msgstr "old"\n\nmsgid "live.key"\nmsgstr "live"\n';
    const { rows, rejected } = parsePo(text);
    expect(rejected).toBe(0);
    expect(rows).toEqual([['live.key', 'live']]);
  });

  it('parses plural entries into indexed slots and captures the header', () => {
    const text = 'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n"Plural-Forms: nplurals=2; plural=(n != 1);\\n"\n\nmsgid "apple"\nmsgid_plural "apples"\nmsgstr[0] "%d apple"\nmsgstr[1] "%d apples"\n';
    const back = parsePo(text);
    expect(back.rejected).toBe(0);
    expect(back.rows).toEqual([]);
    expect(back.pluralEntries).toEqual([['apple', { 0: '%d apple', 1: '%d apples' }]]);
    expect(back.headerPluralForms).toBe('nplurals=2; plural=(n != 1);');
  });

  it('rejects indexed msgstr without msgid_plural, non-consecutive slots and contexts', () => {
    const noPlural = 'msgid "apple"\nmsgstr[0] "%d apple"\nmsgstr[1] "%d apples"\n';
    const gap = 'msgid "apple"\nmsgid_plural "apples"\nmsgstr[0] "a"\nmsgstr[2] "b"\n';
    const dup = 'msgid "apple"\nmsgid_plural "apples"\nmsgstr[0] "a"\nmsgstr[0] "b"\n';
    const mixed = 'msgid "apple"\nmsgid_plural "apples"\nmsgstr "one"\nmsgstr[0] "a"\n';
    const ctxt = 'msgctxt "button"\nmsgid "save"\nmsgstr "Save"\n';
    expect(parsePo(noPlural).rejected).toBe(1);
    expect(parsePo(gap).rejected).toBe(1);
    expect(parsePo(dup).rejected).toBe(1);
    expect(parsePo(mixed).rejected).toBe(1);
    expect(parsePo(ctxt).rejected).toBe(1);
  });

  it('exports plural keys as msgid_plural entries with a Plural-Forms header', () => {
    const out = toPo([['plain', 'x']], [['apples', { one: '# apple', other: '# apples' }]], 'en');
    expect(out).toContain('Plural-Forms: nplurals=2; plural=(n != 1);');
    expect(out).toContain('msgid "apples"\nmsgid_plural "apples"\nmsgstr[0] "# apple"\nmsgstr[1] "# apples"');
    // Own output re-imports: header captured, slots parsed back.
    const back = parsePo(out);
    expect(back.rejected).toBe(0);
    expect(back.pluralEntries).toEqual([['apples', { 0: '# apple', 1: '# apples' }]]);
    expect(back.headerPluralForms).toBe('nplurals=2; plural=(n != 1);');
  });

  it('evaluates the gettext C-expression subset and rejects anything else', () => {
    expect(evalPluralExpr('(n != 1)', 1)).toBe(0);
    expect(evalPluralExpr('(n != 1)', 5)).toBe(1);
    expect(evalPluralExpr('(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2', 3)).toBe(1);
    expect(evalPluralExpr('(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2', 9)).toBe(2);
    expect(evalPluralExpr('(n%100>=3 && n%100<=10) ? 3 : 5', 107)).toBe(3);
    expect(evalPluralExpr('(n%100>=3 && n%100<=10) ? 3 : 5', 22)).toBe(5);
    expect(evalPluralExpr('n/2', 5)).toBe(2); // truncating, like C
    expect(evalPluralExpr('0', 42)).toBe(0);
    expect(evalPluralExpr('nonsense', 1)).toBeNull();
    expect(evalPluralExpr('n % 0', 1)).toBeNull();
    expect(evalPluralExpr('(n != 1', 1)).toBeNull();
    expect(evalPluralExpr('n != 1; evil()', 1)).toBeNull();
  });

  // slotCategories is a verification harness for the reviewed header data
  // (the export table and the import allowlist), not the import path: the
  // service never evaluates untrusted file expressions.
  it('maps slots to CLDR categories by evaluating the expression, never declared order', () => {
    expect(slotCategories('(n != 1)', 2, 'en')).toEqual(['one', 'other']);
    expect(slotCategories('(n > 1)', 2, 'fr')).toEqual(['one', 'other']);
    expect(slotCategories('0', 1, 'ja')).toEqual(['other']);
    expect(slotCategories('(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2', 3, 'cs')).toEqual(['one', 'few', 'other']);
    // English expression against Hebrew: n=2 selects 'two' but slot 1 is
    // already 'other' from n=0 - inconsistent, rejected.
    expect(slotCategories('(n != 1)', 2, 'he')).toBeNull();
    // Russian slots carry one/few/many, 'other' never appears for integers.
    expect(slotCategories('(n%10==1 && n%100!=11) ? 0 : (n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20)) ? 1 : 2', 3, 'ru')).toEqual(['one', 'few', 'many']);
    // Out-of-range index and unused slots are rejected.
    expect(slotCategories('3', 2, 'en')).toBeNull();
    expect(slotCategories('0', 2, 'en')).toBeNull();
  });

  it('verifies every curated export expression against Intl.PluralRules', () => {
    for (const [locale, h] of Object.entries(PO_PLURAL_FORMS)) {
      const parsed = parsePluralFormsHeader(h);
      expect(parsed).not.toBeNull();
      const cats = slotCategories(parsed!.expr, parsed!.nplurals, locale);
      expect(cats).not.toBeNull();
      // The slots must cover every CLDR category of the locale, including
      // 'other' - otherwise export could not represent stored forms.
      const want = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
      expect([...cats!].sort()).toEqual([...want].sort());
    }
  });

  it('canonicalizes whitespace so equivalent spellings match one allowlist key', () => {
    expect(canonicalPluralKey(3, '(n == 1) ? 0 : (n == 2) ? 1 : 2'))
      .toBe('nplurals=3;plural=(n==1)?0:(n==2)?1:2');
    expect(canonicalPluralKey(2, 'n != 1')).toBe('nplurals=2;plural=n!=1');
  });

  it('resolves the documented standard headers, including spelling variants', () => {
    expect(importSlotCategories(2, '(n != 1)', 'en')).toEqual({ categories: ['one', 'other'] });
    expect(importSlotCategories(2, 'n != 1', 'en')).toEqual({ categories: ['one', 'other'] });
    expect(importSlotCategories(2, '(n > 1)', 'fr')).toEqual({ categories: ['one', 'other'] });
    expect(importSlotCategories(2, 'n>1', 'pt')).toEqual({ categories: ['one', 'other'] });
    expect(importSlotCategories(1, '0', 'ja')).toEqual({ categories: ['other'] });
    expect(importSlotCategories(3, '(n==1) ? 0 : (n==2) ? 1 : 2', 'he')).toEqual({ categories: ['one', 'two', 'other'] });
    expect(importSlotCategories(3, '(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2', 'cs')).toEqual({ categories: ['one', 'few', 'other'] });
  });

  it('disambiguates the shared Latvian/Lithuanian header by import target locale', () => {
    const shared = '(n%10==1 && n%100!=11) ? 0 : (n%10>=2 && (n%100<10 || n%100>=20)) ? 1 : 2';
    expect(importSlotCategories(3, shared, 'lv')).toEqual({ categories: ['one', 'other', 'zero'] });
    expect(importSlotCategories(3, shared, 'lt')).toEqual({ categories: ['one', 'few', 'other'] });
    const other = importSlotCategories(3, shared, 'de');
    expect('error' in other).toBe(true);
    if ('error' in other) expect(other.error).toContain('lv, lt');
  });

  it('rejects unlisted headers fail-closed and never evaluates them', () => {
    // Russian standard rule: slots one/few/many, no 'other'.
    expect('error' in importSlotCategories(3, '(n%10==1 && n%100!=11) ? 0 : (n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20)) ? 1 : 2', 'ru')).toBe(true);
    // Arbitrary expressions, however plausible or hostile, are not evaluated.
    expect('error' in importSlotCategories(2, 'nonsense()', 'en')).toBe(true);
    expect('error' in importSlotCategories(2, '(n%1000000==1)', 'en')).toBe(true);
    expect('error' in importSlotCategories(2, 'n!=1;evil()', 'en')).toBe(true);
    // A known expression under a different nplurals count is a different key.
    expect('error' in importSlotCategories(4, '(n != 1)', 'en')).toBe(true);
  });

  it('regression-checks every allowlisted header against Intl.PluralRules on 0..200', () => {
    // Representative locale per locale-agnostic header, used only to verify
    // the reviewed slot->category mapping agrees with Intl.PluralRules.
    const probeLocale: Record<string, string> = {
      'nplurals=1;plural=0': 'ja',
      'nplurals=2;plural=(n!=1)': 'en',
      'nplurals=2;plural=n!=1': 'en',
      'nplurals=2;plural=(n>1)': 'fr',
      'nplurals=2;plural=n>1': 'fr',
      'nplurals=3;plural=(n==1)?0:(n==2)?1:2': 'he',
      'nplurals=3;plural=(n==1)?0:(n>=2&&n<=4)?1:2': 'cs',
      'nplurals=6;plural=(n==0)?0:(n==1)?1:(n==2)?2:(n%100>=3&&n%100<=10)?3:(n%100>=11)?4:5': 'ar',
      'nplurals=3;plural=(n==1)?0:(n==0||(n%100>0&&n%100<20))?1:2': 'ro',
      'nplurals=5;plural=(n==1)?0:(n==2)?1:(n>=3&&n<=6)?2:(n>=7&&n<=10)?3:4': 'ga',
      'nplurals=4;plural=(n%100==1)?0:(n%100==2)?1:(n%100==3||n%100==4)?2:3': 'sl',
    };
    for (const [key, entries] of Object.entries(PO_IMPORT_PLURAL_HEADERS)) {
      const np = Number(/^nplurals=(\d+)/.exec(key)![1]);
      const expr = /;plural=(.*)$/.exec(key)![1];
      for (const entry of entries) {
        expect(entry.categories.length).toBe(np);
        expect(new Set(entry.categories).size).toBe(np);
        expect(entry.categories).toContain('other');
        for (const locale of entry.locales ?? [probeLocale[key]]) {
          expect(slotCategories(expr, np, locale)).toEqual(entry.categories);
          const known = new Intl.PluralRules(locale).resolvedOptions().pluralCategories as string[];
          expect(entry.categories.every((c) => known.includes(c))).toBe(true);
        }
      }
    }
  });

  it('keeps every curated export header importable through the allowlist', () => {
    for (const [locale, h] of Object.entries(PO_PLURAL_FORMS)) {
      const parsed = parsePluralFormsHeader(h);
      expect(parsed).not.toBeNull();
      const mapped = importSlotCategories(parsed!.nplurals, parsed!.expr, locale);
      expect('error' in mapped).toBe(false);
    }
  });

  it('rejects unterminated strings and unknown directives without dropping the file', () => {
    const text = 'msgid "broken\nmsgstr "x"\n\nmsgid "good.key"\nmsgstr "good"\n';
    const { rows, rejected } = parsePo(text);
    expect(rejected).toBe(1);
    expect(rows).toEqual([['good.key', 'good']]);
  });

  it('keeps unknown escapes as both characters', () => {
    const { rows } = parsePo('msgid "k"\nmsgstr "a\\qb"\n');
    expect(rows).toEqual([['k', 'a\\qb']]);
  });
});
