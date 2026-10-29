import { parsePo, toPo } from './po';

describe('PO interchange', () => {
  it('exports entries with escaped quotes, newlines, tabs and backslashes', () => {
    const out = toPo([['app.title', 'My "App"'], ['msg.multi', 'line1\nline2'], ['msg.tab', 'a\tb'], ['msg.bs', 'c:\\path']]);
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
    const back = parsePo(toPo(rows));
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

  it('rejects plurals, indexed msgstr and contexts', () => {
    const plural = 'msgid "apple"\nmsgid_plural "apples"\nmsgstr[0] "%d apple"\nmsgstr[1] "%d apples"\n';
    const ctxt = 'msgctxt "button"\nmsgid "save"\nmsgstr "Save"\n';
    expect(parsePo(plural).rejected).toBe(1);
    expect(parsePo(ctxt).rejected).toBe(1);
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
