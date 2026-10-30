import { parseArb, toArb } from './arb';

describe('Flutter ARB interchange', () => {
  it('exports a JSON object with @@locale', () => {
    const out = toArb([['app.title', 'My App']], [], 'he');
    const parsed = JSON.parse(out);
    expect(parsed['@@locale']).toBe('he');
    expect(parsed['app.title']).toBe('My App');
  });

  it('roundtrips losslessly', () => {
    const rows: [string, string][] = [
      ['home.title', 'Welcome "home"'],
      ['msg.multi', 'line1\nline2'],
      ['unicode', 'שלום 🌍'],
      ['empty', ''],
      ['icu.simple', 'Total: {amount}'],
    ];
    const back = parseArb(toArb(rows, [], 'he'));
    expect(back.rejected).toBe(0);
    expect(back.rows).toEqual(rows);
  });

  it('exports plural keys as ICU messages and roundtrips them', () => {
    const plurals: [string, Record<string, string>][] = [
      ['apples', { one: '# apple', other: '# apples' }],
      ['braces', { one: "literal '{' brace", other: "it's fine" }],
    ];
    const out = toArb([], plurals, 'he');
    const parsed = JSON.parse(out);
    expect(parsed['apples']).toBe('{count, plural, one {# apple} other {# apples}}');
    const back = parseArb(out);
    expect(back.rejected).toBe(0);
    expect(back.plurals).toEqual(plurals);
    expect(back.rows).toEqual([['apples', '# apples'], ['braces', "it's fine"]]);
  });

  it('ignores @@locale and @key metadata', () => {
    const back = parseArb(JSON.stringify({
      '@@locale': 'he',
      'app.title': 'My App',
      '@app.title': { description: 'Title shown on home', placeholders: { amount: { type: 'int' } } },
    }));
    expect(back.rows).toEqual([['app.title', 'My App']]);
    expect(back.rejected).toBe(0);
  });

  it('rejects non-string and nested entry values', () => {
    const back = parseArb(JSON.stringify({
      'ok': 'fine',
      'num': 3,
      'flag': true,
      'nothing': null,
      'nested': { a: 'b' },
      'list': ['x'],
    }));
    expect(back.rows).toEqual([['ok', 'fine']]);
    expect(back.rejected).toBe(5);
  });

  it('parses in-subset ICU plural messages into plurals', () => {
    const back = parseArb(JSON.stringify({
      'apples': '{count, plural, one {# apple} other {# apples}}',
      'quoted': "{n, plural, other {literal '{ and ''quote''}}",
      'ok': 'fine',
    }));
    expect(back.rows).toEqual([['apples', '# apples'], ['quoted', "literal { and 'quote'"], ['ok', 'fine']]);
    expect(back.plurals).toEqual([
      ['apples', { one: '# apple', other: '# apples' }],
      ['quoted', { other: "literal { and 'quote'" }],
    ]);
    expect(back.rejected).toBe(0);
  });

  it('rejects out-of-subset ICU messages', () => {
    const back = parseArb(JSON.stringify({
      'gender': '{g, select, male {he} other {they}}',
      'ord': '{n, selectordinal, one {#st} other {#th}}',
      'offset': '{n, plural, offset:1 one {# apple} other {# apples}}',
      'exact': '{n, plural, =0 {none} other {# apples}}',
      'nested': '{n, plural, other {{g, select, male {he} other {they}} apples}}',
      'mixed': 'You have {count, plural, one {# apple} other {# apples}}',
      'dup': '{n, plural, other {a} other {b}}',
      'badquote': "{n, plural, other {has '# quoted}}",
      'ok': 'fine',
    }));
    expect(back.rows).toEqual([['ok', 'fine']]);
    expect(back.rejected).toBe(8);
  });

  it('rejects malformed JSON and non-object documents', () => {
    expect(parseArb('not json').rejected).toBe(1);
    expect(parseArb('[1,2]').rejected).toBe(1);
    expect(parseArb('"str"').rejected).toBe(1);
  });
});
