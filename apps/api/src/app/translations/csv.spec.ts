import { parseCsv, toCsv } from './csv';

describe('csv', () => {
  it('round-trips plain and special values', () => {
    const rows: [string, string][] = [
      ['app.title', 'My App'],
      ['msg.quote', 'He said "hi", loudly'],
      ['msg.multi', 'line1\nline2'],
      ['msg.crlf', 'a\r\nb'],
    ];
    const parsed = parseCsv(toCsv(rows));
    expect(parsed.rows).toEqual(rows);
    expect(parsed.rejected).toBe(0);
  });
  it('drops a key,value header', () => {
    expect(parseCsv('key,value\na,b\n').rows).toEqual([['a', 'b']]);
  });
  it('accepts LF and CRLF endings', () => {
    expect(parseCsv('a,1\r\nb,2\n').rows).toEqual([['a', '1'], ['b', '2']]);
  });
  it('handles empty values and unicode', () => {
    expect(parseCsv('a,\nb,שלום\n').rows).toEqual([['a', ''], ['b', 'שלום']]);
  });
  it('safe mode shields formula prefixes, raw mode preserves them', () => {
    const rows: [string, string][] = [
      ['k1', '=HYPERLINK("http://evil")'],
      ['k2', '+cmd'],
      ['k3', '-2+3'],
      ['k4', '@mention'],
      ['k5', '\tleading-tab'],
      ['k6', 'plain'],
      ['k7', '  =padded()'],
      ['k8', '\n=lf-prefixed'],
      ['k9', '  plain-padded'],
    ];
    const safe = toCsv(rows, { spreadsheetSafe: true });
    for (const p of ["'=HYPERLINK", "'+cmd", "'-2+3", "'@mention", "'  =padded()", "'\n=lf-prefixed"]) expect(safe).toContain(p);
    expect(safe).toContain('k6,plain');
    expect(safe).toContain('k9,  plain-padded'); // leading space alone is harmless
    const raw = toCsv(rows);
    expect(raw).toContain('=HYPERLINK'); // CSV-escaped but unprefixed
    expect(raw).not.toContain("'=HYPERLINK");
    expect(raw).toContain('+cmd');
    expect(parseCsv(raw).rows).toEqual(rows); // raw roundtrip is lossless
    // delimiter/quote/newline breakout stays one field through roundtrip
    const nasty: [string, string][] = [['k,nasty', 'x,"y\n=d']];
    expect(parseCsv(toCsv(nasty)).rows).toEqual(nasty);
  });
});
