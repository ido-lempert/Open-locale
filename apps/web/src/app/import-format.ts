// Maps an import file's extension to an import/export format kind.
// Deterministic: extension only, never content sniffing. Returns null for an
// unknown or missing extension; callers keep the user's explicit selection.
// Ambiguity resolved by convention: .xml is Android strings XML (XLIFF uses
// .xlf/.xliff); .json is the flat/nested JSON format (Flutter ARB uses .arb).
export type IoFormat = 'json' | 'csv' | 'android' | 'ios' | 'stringsdict' | 'po' | 'pot' | 'xliff' | 'properties' | 'arb' | 'yaml' | 'resx';

const BY_EXTENSION: Record<string, IoFormat> = {
  json: 'json',
  csv: 'csv',
  xml: 'android',
  strings: 'ios',
  stringsdict: 'stringsdict',
  po: 'po',
  pot: 'pot',
  xlf: 'xliff',
  xliff: 'xliff',
  properties: 'properties',
  arb: 'arb',
  yaml: 'yaml',
  yml: 'yaml',
  resx: 'resx',
};

export function detectImportFormat(filename: string): IoFormat | null {
  const base = filename.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return null;
  return BY_EXTENSION[base.slice(dot + 1).toLowerCase()] ?? null;
}
