export interface GlossaryLike {
  term: string;
  notes: string;
  doNotTranslate: boolean;
  translations: Record<string, string>;
}

export interface GlossaryHint {
  term: string;
  locale: string;
  value: string;
  notes: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Unicode-aware word boundary: letters/numbers in any script count as word chars,
// so Hebrew/Arabic terms do not falsely match inside longer words.
export function termInText(term: string, text: string): boolean {
  if (!term || !text) return false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRe(term)}([^\\p{L}\\p{N}_]|$)`, 'iu');
  return re.test(text);
}

export function hintsForTarget(
  sourceText: string,
  targetLocale: string,
  terms: GlossaryLike[],
): GlossaryHint[] {
  if (!sourceText) return [];
  const out: GlossaryHint[] = [];
  for (const g of terms) {
    if (!termInText(g.term, sourceText)) continue;
    out.push({
      term: g.term,
      locale: targetLocale,
      value: g.doNotTranslate ? 'keep as-is' : (g.translations[targetLocale] ?? '(no translation)'),
      notes: g.notes,
    });
  }
  return out;
}
