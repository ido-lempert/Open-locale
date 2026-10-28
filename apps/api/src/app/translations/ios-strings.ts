// iOS .strings interchange: "key" = "value"; lines, C-style escaping.
// Keys with dots are quoted so mapping is 1:1.

const esc = (v: string) =>
  v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');

export function toIosStrings(rows: [string, string][]): string {
  return rows.map(([k, v]) => `"${esc(k)}" = "${esc(v)}";`).join('\n') + '\n';
}

const unesc = (v: string) =>
  v.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

export function parseIosStrings(text: string): { rows: [string, string][]; rejected: number } {
  const rows: [string, string][] = [];
  let rejected = 0;
  // One entry per line: "key" = "value"; with escaped quotes allowed inside.
  const re = /^"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    rows.push([unesc(m[1]), unesc(m[2])]);
  }
  const nonEmpty = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('/*'));
  rejected = Math.max(0, nonEmpty.length - rows.length);
  return { rows, rejected };
}
