// PO (gettext) interchange. Subset: plain msgid/msgstr entries.
// Keys map to msgids 1:1. The metadata header (empty msgid) and obsolete
// entries (#~) are skipped silently; plural forms (msgid_plural, msgstr[n])
// and contexts (msgctxt) cannot roundtrip into flat keys and are rejected.
// Fuzzy flags are translator-workflow comments and import like any entry.
// Duplicate msgids collapse to the last occurrence (Object.fromEntries).

const esc = (v: string) =>
  v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r');

export function toPo(rows: [string, string][]): string {
  const body = rows.map(([k, v]) => `msgid "${esc(k)}"\nmsgstr "${esc(v)}"`).join('\n\n');
  return `# Exported from Open-locale.\n# Keys are msgids; plural and context forms are not used.\n\n${body}\n`;
}

// POT (gettext template): same entry shape with every msgstr empty - a
// template translators fill in, not a translation delivery. Import accepts
// it through the same PO parser: msgids land as keys, empty msgstr values
// land as empty translations.
export function toPot(rows: [string, string][]): string {
  const body = rows.map(([k]) => `msgid "${esc(k)}"\nmsgstr ""`).join('\n\n');
  return `# Exported from Open-locale as a translation template (POT).\n# Keys are msgids; every msgstr is intentionally empty.\n\n${body}\n`;
}

// A PO string literal: double-quoted, with C-style escapes. Unknown escapes
// keep both characters - the roundtrip must stay lossless, never drop data.
const parseLiteral = (s: string): string | null => {
  const t = s.trim();
  if (t.length < 2 || !t.startsWith('"') || !t.endsWith('"')) return null;
  const inner = t.slice(1, -1);
  let out = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && i + 1 < inner.length) {
      const c = inner[++i];
      if (c === 'n') { out += '\n'; continue; }
      if (c === 't') { out += '\t'; continue; }
      if (c === 'r') { out += '\r'; continue; }
      if (c === '"') { out += '"'; continue; }
      if (c === '\\') { out += '\\'; continue; }
      out += '\\' + c;
      continue;
    }
    out += inner[i];
  }
  return out;
};

export function parsePo(text: string): { rows: [string, string][]; rejected: number } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  const rows: [string, string][] = [];
  let rejected = 0;
  let msgid: string | null = null;
  let msgstr = '';
  let unsupported = false;
  let malformed = false;
  let obsolete = false;
  let field: 'none' | 'id' | 'str' = 'none';
  let started = false;

  const flush = () => {
    if (!started) return;
    if (obsolete) { /* commented-out entry: skip silently */ }
    else if (unsupported || malformed) rejected++;
    else if (msgid === '') { /* metadata header: skip silently */ }
    else if (msgid !== null) rows.push([msgid, msgstr]);
    msgid = null; msgstr = ''; unsupported = false; malformed = false; obsolete = false; field = 'none'; started = false;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') { flush(); continue; }
    if (line.startsWith('#~')) { obsolete = true; started = true; continue; }
    if (line.startsWith('#')) { started = true; continue; }
    started = true;
    let v: string | null | undefined;
    if ((v = line.startsWith('msgid_plural') ? parseLiteral(line.slice('msgid_plural'.length)) : undefined) !== undefined) {
      unsupported = true; if (v === null) malformed = true; field = 'none'; continue;
    }
    if ((v = line.startsWith('msgctxt') ? parseLiteral(line.slice('msgctxt'.length)) : undefined) !== undefined) {
      unsupported = true; if (v === null) malformed = true; field = 'none'; continue;
    }
    if ((v = line.startsWith('msgid') ? parseLiteral(line.slice('msgid'.length)) : undefined) !== undefined) {
      if (v === null) malformed = true; else msgid = v; field = 'id'; continue;
    }
    if (/^msgstr\[\d+\]/.test(line)) {
      unsupported = true; field = 'none';
      if (parseLiteral(line.replace(/^msgstr\[\d+\]\s*/, '')) === null) malformed = true;
      continue;
    }
    if ((v = line.startsWith('msgstr') ? parseLiteral(line.slice('msgstr'.length)) : undefined) !== undefined) {
      if (v === null) malformed = true; else msgstr = v; field = 'str'; continue;
    }
    if (line.startsWith('"')) {
      const cont = parseLiteral(line);
      if (cont === null) { malformed = true; continue; }
      if (field === 'id' && msgid !== null) msgid += cont;
      else if (field === 'str') msgstr += cont;
      else malformed = true;
      continue;
    }
    malformed = true;
  }
  flush();
  return { rows, rejected };
}
