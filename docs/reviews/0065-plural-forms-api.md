# 0065 - Plural form write path (slice 2: API + preservation)

translations.pluralForms (slice 1) gains its write path, with every existing
translation writer audited for silent loss:

- PUT /projects/:pid/keys/:kid/translations accepts optional pluralForms:
  { "<cldr-category>": "text" }. Validated in the service: key must be
  isPlural, value must be a non-array object of string values, categories
  must be the locale's CLDR set (Node ICU Intl.PluralRules), and "other" is
  required. Verified over HTTP for en (one/other) and ar (all six);
  rejection cases: non-plural key, category outside the locale set, missing
  other, non-string value. Other locales follow ICU at runtime but are not
  individually claimed.
  Omitting pluralForms leaves stored forms unchanged; null is treated as
  omitted. The documented clear path is marking the key non-plural.
- Preservation, each covered by a plural-test check:
  - value-only upsert keeps stored pluralForms (update touches value/status/
    version only);
  - snapshot capture now includes pluralForms (null or object) and restore
    writes it back exactly; restoring an OLD snapshot without the field
    leaves the live column untouched (no silent NULL-ing);
  - branch merge carries pluralForms in the atomic INSERT ... ON CONFLICT,
    and the merge/preview no-op comparisons include it (a forms-only change
    is merged, not skipped as "identical");
  - PATCH key isPlural=false explicitly NULLs pluralForms in the same tx
    (stale forms never readable); value and other metadata survive;
  - format import writers (all formats route through importJson's upsert,
    which updates value/status/version only and never deletes+recreates a
    translation row) preserve stored forms; verified via JSON import over a
    plural key. Claims limited to that shared path, not per-format re-tests.
- Restore semantics are explicit on the endpoint: fields added after a
  snapshot was taken are left untouched by restore, so restoring an old
  snapshot is not an exact historical reconstruction.
- Optimistic concurrency (version + rowId), task key locks, webhook and
  automation fires, history attribution are unchanged; a forms-only change
  bumps version and writes history.
- Explicit non-goals: no editor UI (slice 3), no format import/export
  (slice 4), stringsdict stays deferred per 0060.
