# 0071 - PO msgid_plural (slice 7: fourth plural-aware format)

PO (gettext) gains a deliberately narrow plural subset, replacing the
previous blanket msgid_plural/msgstr[n] rejection:

- Slot-to-category mapping (SUPERSEDED by 0072 in slice 8 - the derived
  mapping was replaced by a reviewed-header allowlist; the description
  below is kept for chronology): the file's own
  Plural-Forms header expression (a small C subset - integers, n, %, *,
  truncating /, +, -, comparisons, !, &&, ||, ternary, parentheses) is
  evaluated for n=0..200 against Intl.PluralRules of the target locale
  (the same CLDR source the write API uses). The import rejects (400)
  when: the header is missing, the expression is outside the grammar or
  escapes its nplurals range, a slot maps to two categories or a category
  to two slots, a slot is unused, no slot carries 'other' (locales like
  Russian whose gettext slots have no 'other' for fractional quantities),
  or an entry's slot count differs from the declared nplurals. An
  expression inconsistent with the target locale (e.g. an English
  nplurals=2 header on a Hebrew import) is rejected, not guessed.
- Import: an entry with msgid_plural and consecutive msgstr[0..n] slots
  imports as a plural key through the shared machinery (isPlural upgrade,
  forms per category, per-key failure semantics, plain value carries the
  "other" form). msgid_plural is dropped - the key is the msgid; the
  source plural string is not stored (documented, lossy). msgstr[n]
  without msgid_plural, duplicate/non-consecutive slots and msgctxt stay
  rejected. A plain msgid import over a plural key preserves stored forms
  (slice 2 contract). POT imports keep rejecting plural entries (template
  plurals out of scope).
- Export: plural keys with stored forms emit msgid/msgid_plural/msgstr[n]
  entries (msgid_plural repeats the key name - documented, lossy) plus a
  Plural-Forms metadata header, but only for the 24 locales in the curated
  PO_PLURAL_FORMS table. Every table expression is verified in unit tests
  against Intl.PluralRules: slots must map consistently AND cover every
  CLDR category of the locale including 'other'. Locales whose standard
  gettext headers cannot represent their CLDR set (French, Spanish,
  Italian, Portuguese, Czech, Slovak - million-range or decimal-only
  'many'; Russian, Polish and similar - no 'other' slot) are intentionally
  absent: their plural keys export as plain msgid/msgstr from value
  (documented, lossy for the plural intent). Slots whose category has no
  stored form export empty. The export endpoint summary names the fallback.
- Explicit non-goals: msgctxt, plural POT entries, locales outside the
  curated table on export, msgid_plural round-trip. XLIFF plural groups
  remain unsupported (no XLIFF 1.2 standard for them).
- Verified: unit specs (parser slots/header capture, evaluator grammar and
  rejections, derived mapping including the English-header-on-Hebrew
  inconsistency case, curated-table verification against Intl, export
  roundtrip), plus real PG + HTTP in formats-test (import upgrade/mapped
  forms/value, export header+entries, roundtrip, four 400 cases) and
  plural-test (import upgrade, export, plain-import preservation, msgstr[n]
  without msgid_plural 400). The pre-existing "PO plural rejected" spec
  was updated: plural entries without a Plural-Forms header are still
  rejected, now for the precise reason.
