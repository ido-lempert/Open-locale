import { parseResx, toResx } from './resx';

describe('RESX (.NET) interchange', () => {
  it('exports resheaders and xml:space-preserved data entries with escaping', () => {
    const out = toResx([['app.title', 'A & B <C>'], ['quote', 'say "hi"']]);
    expect(out).toContain('<resheader name="resmimetype"><value>text/microsoft-resx</value></resheader>');
    expect(out).toContain('<data name="app.title" xml:space="preserve">');
    expect(out).toContain('<value>A &amp; B &lt;C&gt;</value>');
    expect(out).toContain('<value>say "hi"</value>');
  });

  it('escapes quotes and ampersands in the name attribute', () => {
    const out = toResx([['a"b&c', 'v']]);
    expect(out).toContain('name="a&quot;b&amp;c"');
  });

  it('roundtrips losslessly for flat string resources', () => {
    const rows: [string, string][] = [
      ['home.title', 'Welcome "home" & <all>'],
      ['msg.multi', 'line1\nline2'],
      ['unicode', 'שלום 🌍'],
      ['empty', ''],
      ['spaces', '  padded  '],
    ];
    const back = parseResx(toResx(rows));
    expect(back.rejected).toBe(0);
    expect(back.rows).toEqual(rows);
  });

  it('ignores resheader rows and comment children on import', () => {
    const back = parseResx(toResx([['k', 'v']]));
    expect(back.rows).toEqual([['k', 'v']]);
    const withComment = `<?xml version="1.0" encoding="utf-8"?>\n<root>\n  <data name="k" xml:space="preserve">\n    <value>v</value>\n    <comment>translator note</comment>\n  </data>\n</root>`;
    expect(parseResx(withComment).rows).toEqual([['k', 'v']]);
  });

  it('rejects a document without a root element', () => {
    expect(parseResx('<data name="k"><value>v</value></data>').rejected).toBe(1);
  });

  it('rejects typed/binary resources, metadata and assembly aliases', () => {
    const typed = `<root><data name="img" type="System.Drawing.Bitmap, System.Drawing"><value>base64...</value></data></root>`;
    expect(parseResx(typed).rows).toEqual([]);
    expect(parseResx(typed).rejected).toBe(1);
    expect(parseResx('<root><metadata><data name="k"><value>v</value></data></metadata></root>').rejected).toBe(1);
    expect(parseResx('<root><assembly alias="x" name="Lib"/><data name="k"><value>v</value></data></root>').rejected).toBe(1);
  });

  it('rejects duplicate names, missing values and inner markup', () => {
    const dup = `<root><data name="k"><value>1</value></data><data name="k"><value>2</value></data></root>`;
    const dupBack = parseResx(dup);
    expect(dupBack.rows).toEqual([['k', '1']]);
    expect(dupBack.rejected).toBe(1);
    expect(parseResx('<root><data name="k"/></root>').rejected).toBe(1);
    expect(parseResx('<root><data name="k"><value>a<b>c</value></data></root>').rejected).toBe(1);
  });
});
