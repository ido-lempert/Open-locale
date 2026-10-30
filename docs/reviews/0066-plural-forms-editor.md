# 0066 - Plural forms in the editor (slice 3: UI)

The translation editor renders per-CLDR-category inputs for keys with
isPlural=true, under each locale cell:

- Categories come from the browser's Intl.PluralRules - the same CLDR source
  the API validates against (slice 2); an invalid locale code falls back to
  "other" only. No hardcoded per-locale tables.
- Save reuses the existing blur-to-save cell flow. Plain keys send no
  pluralForms field at all. Plural keys send mergeFormsForSave(saved, edited,
  browserCategories) - NOT simply "every browser category": 0067 corrects
  the first version of this rule, which would have erased stored categories
  unknown to the browser's ICU. Dirty-checking covers value AND forms; the
  saved snapshot updates from the server response.
- Plain (non-plural) keys are visually unchanged.
- e2e-visual: 4 new checks (API-created plural key renders category inputs;
  typed forms reach the API on blur; forms persist across reload; grid
  filtered so the row is in frame for plural-forms.png). 204 PASS / 0 FAIL.
- Explicit non-goal: format import/export of plural forms (slice 4);
  stringsdict stays deferred per 0060.
