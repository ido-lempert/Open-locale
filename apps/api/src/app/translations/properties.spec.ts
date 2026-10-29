import { parseProperties, toProperties } from './properties';

describe('Java .properties interchange', () => {
  it('exports entries with escaped keys and values', () => {
    const out = toProperties([['app.title', 'My App'], ['a.b', 'x=1\ty']]);
    expect(out).toContain('app.title=My App');
    expect(out).toContain('a.b=x=1\\ty');
    expect(out.startsWith('#')).toBe(true);
  });

  it('escapes separators and spaces in keys', () => {
    const out = toProperties([['a=b:c d', 'v']]);
    expect(out).toContain('a\\=b\\:c\\ d=v');
  });

  it('roundtrips losslessly', () => {
    const rows: [string, string][] = [
      ['home.title', 'Welcome home'],
      ['msg.multi', 'line1\nline2'],
      ['msg.tab', 'a\tb'],
      ['msg.bs', 'c:\\path'],
      ['unicode', 'שלום 🌍'],
      ['empty', ''],
      ['key.with=dots:and spaces', 'v'],
    ];
    const back = parseProperties(toProperties(rows));
    expect(back.rejected).toBe(0);
    expect(back.rows).toEqual(rows);
  });

  it('parses colon and whitespace separators, comments and blank lines', () => {
    const text = '# comment\n! another\n\nkey1 : value1\nkey2 value2\nkey3=value3\n';
    const back = parseProperties(text);
    expect(back.rows).toEqual([['key1', 'value1'], ['key2', 'value2'], ['key3', 'value3']]);
    expect(back.rejected).toBe(0);
  });

  it('unescapes \\uXXXX and preserves escaped backslash + n', () => {
    const back = parseProperties('a=\\u05e9\nb=c:\\\\path\n');
    expect(back.rows).toEqual([['a', 'ש'], ['b', 'c:\\path']]);
  });

  it('joins continuation lines', () => {
    const back = parseProperties('long=line one \\\n  line two\n');
    expect(back.rows).toEqual([['long', 'line one line two']]);
  });

  it('rejects separator-less lines, duplicate keys and bad unicode escapes', () => {
    expect(parseProperties('no separator here is wrong\n').rejected).toBe(0); // whitespace separator: key "no", value "separator here is wrong"
    const back = parseProperties('onlykey\na=1\na=2\nb=\\u12xz\n');
    expect(back.rows).toEqual([['a', '1']]); // first occurrence stands
    expect(back.rejected).toBe(3);
  });
});
