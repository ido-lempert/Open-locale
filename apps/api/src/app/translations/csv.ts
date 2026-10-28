// Minimal, correct CSV for translation interchange: RFC-4180 quoting,
// \r\n row endings, header row 'key,value'.

export function toCsv(rows: [string, string][]): string {
  const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return ['key,value', ...rows.map(([k, v]) => `${esc(k)},${esc(v)}`)].join('\r\n') + '\r\n';
}

export function parseCsv(text: string): { rows: [string, string][]; rejected: number } {
  const rows: [string, string][] = [];
  let rejected = 0;
  let i = 0, field = '', record: string[] = [], inQuotes = false, line = 1;
  const endField = () => { record.push(field); field = ''; };
  const endRecord = () => { endField(); record.length && rows.push([record[0] ?? '', record[1] ?? ''] as [string, string]); if (record.length > 2) rejected++; record = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { endField(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { endRecord(); line++; i++; continue; }
    field += c; i++;
  }
  if (field.length || record.length) endRecord();
  // Drop a header row if present
  if (rows.length && rows[0][0] === 'key' && rows[0][1] === 'value') rows.shift();
  return { rows, rejected };
}
