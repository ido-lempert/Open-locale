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
});
