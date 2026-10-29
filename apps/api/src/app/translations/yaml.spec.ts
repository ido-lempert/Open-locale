import { parseYaml, toYaml } from './yaml';

describe('YAML interchange (Rails-style subset)', () => {
  it('exports nested maps with quoted keys and values', () => {
    const out = toYaml([['app.title', 'My "App"'], ['app.subtitle', 'hi']]);
    expect(out).toContain('"app":');
    expect(out).toContain('  "title": "My \\"App\\""');
    expect(out).toContain('  "subtitle": "hi"');
  });

  it('falls back to a flat map when a key is a dot-prefix of another', () => {
    const out = toYaml([['a', 'leaf'], ['a.b', 'child']]);
    expect(out).toContain('"a": "leaf"');
    expect(out).toContain('"a.b": "child"');
    expect(out).not.toContain('"a":\n');
  });

  it('roundtrips losslessly', () => {
    const rows: [string, string][] = [
      ['home.title', 'Welcome "home"'],
      ['msg.multi', 'line1\nline2'],
      ['unicode', 'שלום 🌍'],
      ['empty', ''],
      ['deep.nested.key', 'v'],
    ];
    const back = parseYaml(toYaml(rows));
    expect(back.rejected).toBe(0);
    // Export sorts keys within each map level; compare order-insensitively.
    expect([...back.rows].sort()).toEqual([...rows].sort());
  });

  it('parses plain and single-quoted scalars, strips trailing comments', () => {
    const text = [
      '# comment',
      'plain: hello world # trailing',
      "single: 'it''s'",
      'c#tag: keeps the hash',
      '',
    ].join('\n');
    const back = parseYaml(text);
    expect(back.rejected).toBe(0);
    expect(back.rows).toEqual([['plain', 'hello world'], ['single', "it's"], ['c#tag', 'keeps the hash']]);
  });

  it('flattens nested maps with dot keys', () => {
    const back = parseYaml('en:\n  home:\n    title: Welcome\n');
    expect(back.rows).toEqual([['en.home.title', 'Welcome']]);
    expect(back.rejected).toBe(0);
  });

  it('rejects document markers, lists, flow collections, anchors, aliases, tags and block scalars', () => {
    expect(parseYaml('---\na: b\n').rejected).toBe(1);
    expect(parseYaml('a:\n  - item\n').rejected).toBe(2); // the list item AND the null leaf it orphaned
    expect(parseYaml('a: {b: c}\n').rejected).toBe(1);
    expect(parseYaml('a: &anc v\nb: *anc\n').rejected).toBe(2);
    expect(parseYaml('a: !!str v\n').rejected).toBe(1);
    expect(parseYaml('a: |\n  block\n').rejected).toBe(2); // the block-scalar marker AND its orphan content line
  });

  it('rejects bare null leaves, duplicate keys and bad escapes', () => {
    expect(parseYaml('a:\nb: 1\n').rejected).toBe(1); // a is a null leaf
    expect(parseYaml('endnull:\n').rejected).toBe(1); // trailing bare key
    expect(parseYaml('a: 1\na: 2\n').rejected).toBe(1);
    expect(parseYaml('a: "bad \\q escape"\n').rejected).toBe(1);
    expect(parseYaml('a: "unterminated\n').rejected).toBe(1);
  });

  it('treats all leaf scalars as strings (no YAML typing)', () => {
    const back = parseYaml('t: true\nn: 123\nword: null\n');
    expect(back.rejected).toBe(0);
    expect(back.rows).toEqual([['t', 'true'], ['n', '123'], ['word', 'null']]);
  });
});
