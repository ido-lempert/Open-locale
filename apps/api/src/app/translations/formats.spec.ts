import { parseAndroidXml, toAndroidXml } from './android-xml';
import { parseIosStrings, toIosStrings } from './ios-strings';

describe('android-xml', () => {
  it('round-trips entities, quotes and newlines', () => {
    const rows: [string, string][] = [
      ['app.title', 'Rocks & Co <b>'],
      ['msg.quote', `it's "quoted"\nnext`],
      ['plain', 'hello'],
    ];
    expect(parseAndroidXml(toAndroidXml(rows)).rows).toEqual(rows);
  });
  it('rejects nested markup and malformed entries', () => {
    const { rows, rejected } = parseAndroidXml(
      '<resources><string name="a">x</string><string name="b">has <b>tag</b></string><string bad>y</resources>',
    );
    expect(rows).toEqual([['a', 'x']]);
    expect(rejected).toBe(2);
  });
});

describe('ios-strings', () => {
  it('round-trips escapes', () => {
    const rows: [string, string][] = [
      ['app.title', 'My "App"'],
      ['a.b', 'line1\nline2\ttab\\back'],
    ];
    expect(parseIosStrings(toIosStrings(rows)).rows).toEqual(rows);
  });
  it('rejects malformed lines, tolerates comments', () => {
    const { rows, rejected } = parseIosStrings('// comment\n"a" = "b";\nnot an entry\n');
    expect(rows).toEqual([['a', 'b']]);
    expect(rejected).toBe(1);
  });
});

describe('android-xml adversarial', () => {
  it('escapes quotes inside keys so export stays well-formed', () => {
    const rows: [string, string][] = [['we"ird', 'v']];
    const xml = toAndroidXml(rows);
    expect(xml).toContain('name="we&quot;ird"');
    expect(parseAndroidXml(xml).rows).toEqual(rows);
  });
  it('keeps a literal backslash+n as backslash+n, not a newline', () => {
    const rows: [string, string][] = [['path', 'C:\\new\\folder']];
    expect(parseAndroidXml(toAndroidXml(rows)).rows).toEqual(rows);
  });
  it('never expands entities and rejects DOCTYPE/entity declarations outright', () => {
    const xml = '<?xml version="1.0"?><!DOCTYPE resources [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>\n' +
      '<resources><string name="a">&xxe;</string></resources>';
    const { rows, rejected } = parseAndroidXml(xml);
    // Tested behavior: no entity expansion happens; and unsupported DTD/entity
    // markup is counted so the import is rejected rather than half-imported.
    expect(rows).toEqual([['a', '&xxe;']]);
    expect(rejected).toBeGreaterThanOrEqual(2); // <!DOCTYPE + <!ENTITY
  });
  it('passes unknown entities through literally', () => {
    expect(parseAndroidXml('<resources><string name="a">x&nbsp;y</string></resources>').rows)
      .toEqual([['a', 'x&nbsp;y']]);
  });
  it('counts plurals and string-arrays as rejected so imports cannot silently lose them', () => {
    const xml = '<resources><plurals name="cats"><item quantity="one">one</item></plurals>' +
      '<string-array name="arr"><item>x</item></string-array><string name="a">v</string></resources>';
    const { rows, rejected } = parseAndroidXml(xml);
    expect(rows).toEqual([['a', 'v']]);
    expect(rejected).toBe(2);
  });
});

describe('ios-strings adversarial', () => {
  it('keeps a literal backslash+n as backslash+n, not a newline', () => {
    const rows: [string, string][] = [['path', 'C:\\new']];
    expect(parseIosStrings(toIosStrings(rows)).rows).toEqual(rows);
  });
  it('does not count multi-line block comments as rejected', () => {
    const { rows, rejected } = parseIosStrings('/* header\nspanning lines */\n"a" = "b";\n');
    expect(rows).toEqual([['a', 'b']]);
    expect(rejected).toBe(0);
  });

  it('rejects an Android import with no <resources> root instead of a silent zero-key import', () => {
    const { rows, rejected } = parseAndroidXml('<xliff version="1.2"><file><body><trans-unit id="a"><source>s</source><target>t</target></trans-unit></body></file></xliff>');
    expect(rows).toEqual([]);
    expect(rejected).toBe(1);
  });
});
