import { parseXliff, toXliff } from './xliff';

describe('XLIFF 1.2 interchange', () => {
  it('exports units with XML-escaped source and target', () => {
    const out = toXliff([['app.title', 'A & B <C>'], ['quote', 'say "hi"']], 'en', 'he');
    expect(out).toContain('<xliff version="1.2"');
    expect(out).toContain('source-language="en"');
    expect(out).toContain('target-language="he"');
    expect(out).toContain('<trans-unit id="app.title">');
    expect(out).toContain('<source>A &amp; B &lt;C&gt;</source>');
    expect(out).toContain('<target>say "hi"</target>');
  });

  it('escapes quotes and ampersands in the id attribute', () => {
    const out = toXliff([['a"b&c', 'v']], 'en', 'he');
    expect(out).toContain('id="a&quot;b&amp;c"');
  });

  it('roundtrips losslessly', () => {
    const rows: [string, string][] = [
      ['home.title', 'Welcome "home" & <all>'],
      ['msg.multi', 'line1\nline2'],
      ['unicode', 'שלום 🌍'],
      ['empty', ''],
    ];
    const back = parseXliff(toXliff(rows, 'en', 'he'));
    expect(back.rejected).toBe(0);
    expect(back.skipped).toBe(0);
    expect(back.rows).toEqual(rows);
  });

  it('rejects inline markup inside source or target', () => {
    const text = `<?xml version="1.0"?><xliff version="1.2"><file><body>
      <trans-unit id="a"><source>he<g id="1">llo</g></source><target>x</target></trans-unit>
      <trans-unit id="b"><source>ok</source><target>va<x/>l</target></trans-unit>
    </body></file></xliff>`;
    const back = parseXliff(text);
    expect(back.rows).toEqual([]);
    expect(back.rejected).toBe(2);
  });

  it('rejects group nesting, alt-trans and duplicate or missing ids', () => {
    expect(parseXliff('<xliff><file><body><group id="g"><trans-unit id="a"><source>s</source><target>t</target></trans-unit></group></body></file></xliff>').rejected).toBe(1);
    const alt = parseXliff('<xliff><file><body><trans-unit id="a"><source>s</source><target>t</target><alt-trans><target>u</target></alt-trans></trans-unit></body></file></xliff>');
    expect(alt.rows).toEqual([]);
    expect(alt.rejected).toBe(1);
    const dup = parseXliff('<xliff><file><body><trans-unit id="a"><source>s</source><target>1</target></trans-unit><trans-unit id="a"><source>s</source><target>2</target></trans-unit></body></file></xliff>');
    expect(dup.rows).toEqual([['a', '1']]);
    expect(dup.rejected).toBe(1);
    const noid = parseXliff('<xliff><file><body><trans-unit><source>s</source><target>t</target></trans-unit></body></file></xliff>');
    expect(noid.rows).toEqual([]);
    expect(noid.rejected).toBe(1);
  });

  it('skips units without a target instead of wiping the value', () => {
    const back = parseXliff('<xliff><file><body><trans-unit id="a"><source>only source</source></trans-unit><trans-unit id="b"><source>s</source><target>t</target></trans-unit></body></file></xliff>');
    expect(back.rows).toEqual([['b', 't']]);
    expect(back.skipped).toBe(1);
    expect(back.rejected).toBe(0);
  });

  it('accepts a self-closing target as an empty value', () => {
    const back = parseXliff('<xliff><file><body><trans-unit id="a"><source>s</source><target/></trans-unit></body></file></xliff>');
    expect(back.rows).toEqual([['a', '']]);
  });

  it('rejects a document with no <xliff> root instead of a silent zero-key import', () => {
    const res = parseXliff('<?xml version="1.0"?><resources><string name="a">x</string></resources>');
    expect(res.rows).toEqual([]);
    expect(res.rejected).toBe(1);
  });
});
