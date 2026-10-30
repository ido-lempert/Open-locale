// Plural-form helpers for the editor. Browser and server run different ICU
// builds, so their CLDR category sets for the same locale can differ. The
// save merge below is the load-bearing rule: categories stored on the server
// that THIS browser's ICU does not know must survive a save untouched, and
// categories the browser knows but were never stored are sent as empty
// strings (the API requires "other" to be present). Only categories the
// browser knows AND the user edited carry new text.

export function pluralCategories(locale: string): string[] {
  try { return new Intl.PluralRules(locale).resolvedOptions().pluralCategories; }
  catch { return ['other']; }
}

export function mergeFormsForSave(
  savedForms: Record<string, string>,
  editedForms: Record<string, string>,
  browserCategories: string[],
): Record<string, string> {
  // Start from the server's last-known object: unknown categories survive.
  const out: Record<string, string> = { ...savedForms };
  // Browser-known categories take the edited text ('' when untouched), so an
  // intentional clear is written and "other" is always present.
  for (const cat of browserCategories) out[cat] = editedForms[cat] ?? '';
  return out;
}
