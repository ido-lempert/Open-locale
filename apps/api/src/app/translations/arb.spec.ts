import { parseArb, toArb } from './arb';

describe('Flutter ARB interchange', () => {
  it('exports a JSON object with @@locale', () => {
    const out = toArb([['app.title', 'My App']], 'he');
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
    const back = parseArb(toArb(rows, 'he'));
    expect(back.rejected).toBe(0);
    expect(back.rows).toEqual(rows);
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

  it('rejects ICU plural/select messages', () => {
    const back = parseArb(JSON.stringify({
      'apples': '{count, plural, one {# apple} other {# apples}}',
      'gender': '{g, select, male {he} other {they}}',
      'ok': 'fine',
    }));
    expect(back.rows).toEqual([['ok', 'fine']]);
    expect(back.rejected).toBe(2);
  });

  it('rejects malformed JSON and non-object documents', () => {
    expect(parseArb('not json').rejected).toBe(1);
    expect(parseArb('[1,2]').rejected).toBe(1);
    expect(parseArb('"str"').rejected).toBe(1);
  });
});
