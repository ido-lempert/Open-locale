// iOS .strings interchange: "key" = "value"; lines, C-style escaping.
// Keys with dots are quoted so mapping is 1:1.

const esc = (v: string) =>
  v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');

export function toIosStrings(rows: [string, string][]): string {
  return rows.map(([k, v]) => `"${esc(k)}" = "${esc(v)}";`).join('\n') + '\n';
}

// Sequential left-to-right scan: replace- chains get \\\\n (escaped backslash +
// 'n') wrong by turning it into a newline; the roundtrip must stay lossless.
const unesc = (v: string) => {
  let out = '';
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '\\' && i + 1 < v.length) {
      const c = v[++i];
      if (c === 'n') { out += '\n'; continue; }
      if (c === 'r') { out += '\r'; continue; }
      if (c === 't') { out += '\t'; continue; }
      if (c === '"') { out += '"'; continue; }
      if (c === '\\') { out += '\\'; continue; }
      out += '\\' + c; // unknown escape: keep both characters, never drop data
      continue;
    }
    out += v[i];
  }
  return out;
};

export function parseIosStrings(text: string): { rows: [string, string][]; rejected: number } {
  const rows: [string, string][] = [];
  let rejected = 0;
  // One entry per line: "key" = "value"; with escaped quotes allowed inside.
  const re = /^"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    rows.push([unesc(m[1]), unesc(m[2])]);
  }
  // Count real content lines that produced no entry. Strip /* ... */ blocks first
  // so their continuation lines are not counted as rejections.
  const withoutBlocks = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const nonEmpty = withoutBlocks
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('//'));
  rejected = Math.max(0, nonEmpty.length - rows.length);
  return { rows, rejected };
}
