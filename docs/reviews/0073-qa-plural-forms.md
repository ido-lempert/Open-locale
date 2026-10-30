# 0073 - QA checks on plural category forms (slice 9)

QA previously checked only the plain value of a translation, which for a
plural key is just the 'other' form: placeholders dropped in any other
category form, missing category forms, and over-length non-other forms
were invisible.

- Plural keys with source pluralForms are now checked PER CATEGORY,
  anchored on the source (base-locale) form set: a target form that is
  missing or empty for a category the source fills is flagged
  'untranslated'; placeholder families ({var} and printf tokens) are
  compared per category form; maxLength applies to every category form.
  Details name the category (e.g. category "one": en has [%d], he has
  [none]). Issue types are unchanged - no API shape change.
- The value-level checks are skipped for these keys because they would
  double-report the 'other' form (value carries it). 'other' remains
  covered through the per-category path, so no check is lost.
- Conservative scope, documented limitation: categories a target locale
  needs BEYOND the source form set (e.g. Arabic zero/two on an English
  one/other source) are not derived - the anchor is the source form set,
  matching how the existing value-level checks anchor on the source
  value. Target-only extra forms are ignored.
- Non-plural keys and plural keys whose source has no stored forms keep
  the previous value-level behavior exactly.
- Verified: real PG + HTTP in qa-test (16 legs, +6): missing source
  category form flagged untranslated with the category named, per-form
  placeholder mismatch with both placeholder sets in the detail, exactly
  two issues for the mixed target (no double-report of 'other'),
  consistent target clean, per-form maxLength (over-length 'other'
  flagged, within-limit 'one' not, whole-key untranslated still fires
  for a locale with no translation), source-forms PUT accepted.
