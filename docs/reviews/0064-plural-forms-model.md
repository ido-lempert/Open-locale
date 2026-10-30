# 0064 - Plural form storage (slice 1: data model only)

PLAN.md (line 54) scopes "plural-aware key metadata". Key.isPlural already
exists; what was missing is storage for per-category plural values.

- translations.pluralForms (jsonb, NULL): for keys with isPlural=true, an
  object mapping CLDR category (zero/one/two/few/many/other) to text, e.g.
  { "one": "1 item", "other": "# items" }. NULL for non-plural keys, whose
  single value stays in translations.value.
- Hand-written migration 20261030023000_translation_plural_forms:
  ALTER TABLE translations ADD COLUMN "pluralForms" jsonb. Nullable, no
  backfill: existing rows are untouched (no silent rewrite).
- Json matches the established schema pattern (activity.detail,
  snapshots, automations payload).
- Deliberately NOT in this slice: no API write path (slice 2 adds DTO +
  CLDR category validation per locale), no editor UI (slice 3), no format
  import/export (slice 4). Nothing reads or writes pluralForms yet, so
  this slice changes no runtime behavior.
- Boundary: CLDR plural-category rules are a documented subset; no broad
  ICU MessageFormat or stringsdict support is implied. stringsdict stays
  deferred per 0060 until this stack lands.
