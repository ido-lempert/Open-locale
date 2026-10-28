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
