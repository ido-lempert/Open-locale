// YAML interchange (Rails style). Subset, stated plainly:
// - one document of nested string maps; keys with dots export as nested maps
// - keys and values may be plain, 'single-quoted' or "double-quoted"
// - all leaf scalars are treated as strings (no YAML bool/int/null typing)
// Rejected, never silently dropped: document markers (--- / ...), lists
// (- item), flow collections ({a: b} / [a]), anchors/aliases/tags (& * !),
// block scalars (| >), tabs in indentation, duplicate flattened keys, and
// bare leaf keys with no value (YAML null).
// Export always double-quotes keys and values: uniform and lossless.
// If one stored key is a dot-prefix of another (cannot nest), the whole
// file falls back to a flat map of quoted keys.

const yamlEscapeDouble = (v: string) =>
  v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t').replace(/\r/g, '\\r');

export function toYaml(rows: [string, string][]): string {
  const keys = rows.map(([k]) => k);
  const collides = keys.some((k) => keys.some((o) => o !== k && o.startsWith(k + '.')));
  if (collides) {
    const body = rows.map(([k, v]) => `"${yamlEscapeDouble(k)}": "${yamlEscapeDouble(v)}"`).join('\n');
    return `# open-locale export (flat: a key is a dot-prefix of another)\n${body}\n`;
  }
  // Build a nested tree, then emit with 2-space indentation.
  const tree = new Map<string, unknown>();
  for (const [k, v] of rows) {
    const parts = k.split('.');
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.has(parts[i])) node.set(parts[i], new Map<string, unknown>());
      node = node.get(parts[i]) as Map<string, unknown>;
    }
    node.set(parts[parts.length - 1], v);
  }
  const lines: string[] = [];
  const emit = (node: Map<string, unknown>, depth: number) => {
    for (const [k, v] of [...node.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const pad = '  '.repeat(depth);
      if (typeof v === 'string') {
        lines.push(`${pad}"${yamlEscapeDouble(k)}": "${yamlEscapeDouble(v)}"`);
      } else {
        lines.push(`${pad}"${yamlEscapeDouble(k)}":`);
        emit(v as Map<string, unknown>, depth + 1);
      }
    }
  };
  emit(tree, 0);
  return `# open-locale export\n${lines.join('\n')}\n`;
}

function unquote(text: string): string | null {
  if (text.startsWith("'")) {
    if (text.length < 2 || !text.endsWith("'")) return null;
    return text.slice(1, -1).replace(/''/g, "'");
  }
  if (text.startsWith('"')) {
    if (text.length < 2 || !text.endsWith('"')) return null;
    const inner = text.slice(1, -1);
    let out = '';
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] !== '\\') { out += inner[i]; continue; }
      if (i + 1 >= inner.length) return null;
      const c = inner[++i];
      if (c === 'n') { out += '\n'; continue; }
      if (c === 't') { out += '\t'; continue; }
      if (c === 'r') { out += '\r'; continue; }
      if (c === '"') { out += '"'; continue; }
      if (c === '\\') { out += '\\'; continue; }
      if (c === 'u') {
        const hex = inner.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
        continue;
      }
      return null; // unknown escape: reject rather than guess
    }
    return out;
  }
  return null; // not quoted
}

const FORBIDDEN_PLAIN_START = /^(?:!|&|\*|\{|\[|\||>|@|`|-\s)/;
const FORBIDDEN_ANYWHERE_RE = /(^|\s)(?:&\w+|\*\w+|![\w!])|^\s*\.\.\.\s*$/;

export function parseYaml(text: string): { rows: [string, string][]; rejected: number } {
  const rows: [string, string][] = [];
  let rejected = 0;
  const seen = new Set<string>();
  const stack: { indent: number; prefix: string; children: number }[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (/^(---|\.\.\.)/.test(line.trimStart())) { rejected++; continue; }
    if (line.startsWith('\t') || /\t /.test(line.slice(0, line.length - line.trimStart().length))) { rejected++; continue; }
    const indent = line.length - line.trimStart().length;
    const content = line.trimStart();
    if (content.startsWith('- ') || content === '-') { rejected++; continue; } // list item
    // Split key from value at the first unquoted ': ' or trailing ':'.
    let keyText = '';
    let rest = '';
    if (content.startsWith('"') || content.startsWith("'")) {
      const q = content[0];
      let end = -1;
      for (let i = 1; i < content.length; i++) {
        if (q === '"' && content[i] === '\\') { i++; continue; }
        if (content[i] === q) {
          if (q === "'" && content[i + 1] === "'") { i++; continue; }
          end = i; break;
        }
      }
      if (end === -1 || content[end + 1] !== ':') { rejected++; continue; }
      keyText = content.slice(0, end + 1);
      rest = content.slice(end + 2).replace(/^ /, '');
    } else {
      const m = /^([^:]+):(?: (.*))?$/.exec(content);
      if (!m) { rejected++; continue; }
      keyText = m[1].trim();
      rest = m[2] ?? '';
      if (keyText === '') { rejected++; continue; }
    }
    const key = keyText.startsWith('"') || keyText.startsWith("'") ? unquote(keyText) : keyText;
    if (key === null || key === '') { rejected++; continue; }
    // Popped frames with no children were bare `key:` null leaves: reject.
    while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
      const frame = stack.pop()!;
      if (frame.children === 0) rejected++;
    }
    if (stack.length > 0) stack[stack.length - 1].children++;
    const prefix = stack.length > 0 ? stack[stack.length - 1].prefix + '.' : '';
    const flat = prefix + key;
    if (rest === '') {
      // Map node opens (children follow at greater indent).
      stack.push({ indent, prefix: flat, children: 0 });
      continue;
    }
    if (FORBIDDEN_PLAIN_START.test(rest) || FORBIDDEN_ANYWHERE_RE.test(rest)) { rejected++; continue; }
    let value: string | null;
    if (rest.startsWith('"') || rest.startsWith("'")) {
      value = unquote(rest);
      if (value === null) { rejected++; continue; }
    } else {
      // Plain scalar: strip a trailing ' # comment', no typing.
      value = rest.replace(/ #.*$/, '');
    }
    if (seen.has(flat)) { rejected++; continue; }
    seen.add(flat);
    rows.push([flat, value]);
  }
  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.children === 0) rejected++;
  }
  return { rows, rejected };
}
