// Java .properties interchange. Subset: key=value (or key: value) lines,
// '#'/'!' comments, backslash continuation lines, standard escapes
// (\t \n \r \f \\ \' \" \space \= \: \uXXXX). Keys and values escape the
// separators and leading whitespace on export. Non-ASCII is written as
// UTF-8 directly (Java 9+ default); no native2ascii \uXXXX emission.
// Lines without a separator are rejected, never silently skipped.

const NEEDS_KEY_ESCAPE_RE = /([\\=:])/g;

function escapeKey(k: string): string {
  return k
    .replace(/\\/g, '\\\\')
    .replace(NEEDS_KEY_ESCAPE_RE, '\\$1')
    .replace(/ /g, '\\ ')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\f/g, '\\f');
}

function escapeValue(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\f/g, '\\f');
}

export function toProperties(rows: [string, string][]): string {
  const body = rows.map(([k, v]) => `${escapeKey(k)}=${escapeValue(v)}`).join('\n');
  return `# open-locale export (UTF-8; Java 9+ reads .properties as UTF-8)\n${body}\n`;
}

// Sequential unescape: a replace-chain would turn the two-character sequence
// \\n (escaped backslash + n) into a newline and lose data.
function unescape(s: string): string | null {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '\\') { out += s[i]; continue; }
    if (i + 1 >= s.length) return null; // trailing lone backslash
    const c = s[++i];
    if (c === 'n') { out += '\n'; continue; }
    if (c === 't') { out += '\t'; continue; }
    if (c === 'r') { out += '\r'; continue; }
    if (c === 'f') { out += '\f'; continue; }
    if (c === 'u') {
      const hex = s.slice(i + 1, i + 5);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 4;
      continue;
    }
    out += c; // \\, \=, \:, \space, \", \' and any other escaped char
  }
  return out;
}

export function parseProperties(text: string): { rows: [string, string][]; rejected: number } {
  const rows: [string, string][] = [];
  let rejected = 0;
  const seen = new Set<string>();
  // Join continuation lines (odd number of trailing backslashes).
  const logical: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (logical.length > 0 && /\\$/.test(logical[logical.length - 1]) && !/\\\\$/.test(logical[logical.length - 1])) {
      logical[logical.length - 1] = logical[logical.length - 1].slice(0, -1) + line.replace(/^\s+/, '');
    } else {
      logical.push(line);
    }
  }
  for (const line of logical) {
    const trimmed = line.replace(/^\s+/, '');
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
    // First unescaped = or : (or bare whitespace) separates key and value.
    let sep = -1;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '\\') { i++; continue; }
      if (line[i] === '=' || line[i] === ':') { sep = i; break; }
      if (line[i] === ' ' || line[i] === '\t') { sep = i; break; }
    }
    if (sep === -1) { rejected++; continue; }
    const rawKey = line.slice(0, sep);
    let vi = sep;
    if (line[vi] === ' ' || line[vi] === '\t') {
      while (vi < line.length && (line[vi] === ' ' || line[vi] === '\t')) vi++;
      if (line[vi] === '=' || line[vi] === ':') vi++;
    } else {
      vi++;
    }
    while (vi < line.length && (line[vi] === ' ' || line[vi] === '\t')) vi++;
    const key = unescape(rawKey.replace(/^\s+|\s+$/g, ''));
    const value = unescape(line.slice(vi));
    if (key === null || value === null || key === '') { rejected++; continue; }
    if (seen.has(key)) { rejected++; continue; }
    seen.add(key);
    rows.push([key, value]);
  }
  return { rows, rejected };
}
