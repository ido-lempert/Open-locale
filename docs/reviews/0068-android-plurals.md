# 0068 - Android XML plurals (slice 4: first plural-aware format)

The Android strings.xml format gains a deliberately narrow plural subset:

- Import: <plurals name="..."><item quantity="cat">text</item>*</plurals>
  where quantity is one of the six CLDR categories, unique per element, no
  inner markup. An imported <plurals> UPGRADES the key to isPlural=true
  (explicit, documented) and writes pluralForms; the plain value carries the
  "other" form so single-value readers (CSV, other formats, TM) see a
  sensible string. Categories are validated against the target locale's CLDR
  set (same Intl.PluralRules source as the write API): a category the locale
  does not use fails that key on the import run (per-key failure semantics,
  not a 400); a non-CLDR quantity, duplicate quantity, or inner markup
  rejects the whole import (400), consistent with existing parser rules.
  A <plurals> import REPLACES stored forms (imported wording wins, same as
  value). A <string> import for a plural key omits pluralForms and preserves
  them (slice 2 preservation contract).
- Export: keys with isPlural and at least one stored form emit a <plurals>
  element with items in canonical CLDR order (zero/one/two/few/many/other);
  a plural key without stored forms falls back to a plain <string> from
  value (valid Android; lossy for the plural intent, documented here).
  string-array, DOCTYPE/entity declarations and inner markup remain
  rejected, unchanged.
- Verified over real PG + HTTP in formats-test (import sets metadata+forms,
  value=other, export emits ordered items, three rejection cases) and
  plural-test (import upgrade, export, string-import preservation).
- Explicit non-goals: PO msgid_plural, ARB ICU messages, XLIFF plural
  groups and iOS stringsdict remain unsupported/rejected exactly as before;
  stringsdict stays deferred per 0060. No other format reads or writes
  pluralForms yet.
