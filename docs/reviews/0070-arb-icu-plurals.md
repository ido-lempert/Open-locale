# 0070 - Flutter ARB ICU plurals (slice 6: third plural-aware format)

ARB gains a deliberately narrow ICU plural subset, replacing the previous
blanket ICU rejection:

- Import: a value that is exactly one plural message -
  {count, plural, one {...} other {...}} - with CLDR category selectors
  only, unique per message, no offset, no exact-value (=0) selectors, no
  nested braces. Such a value imports through the same shared machinery as
  Android and stringsdict (isPlural upgrade, forms per category, per-key
  locale-CLDR validation and failure semantics, plain value carries the
  "other" form). Apostrophe-quoting is interpreted only for '' '{' '}';
  lone apostrophes are literal (ICU lenient rule); quoting of # or | is
  rejected. ICU select/selectordinal, mixed text-plus-message values and
  everything outside the subset stay rejected (400), never silently
  altered. A plain (non-ICU) ARB entry over a plural key preserves stored
  forms (slice 2 preservation contract).
- Export: plural keys with stored forms emit one ICU plural message with
  categories in canonical CLDR order; literal ' { } in forms are escaped
  with ICU quoting so exported output re-imports; the plural variable name
  is normalized to "count" (documented, lossy - ARB placeholder metadata
  is not round-tripped, unchanged). A plural key without stored forms
  falls back to a plain entry from value (documented, lossy for the plural
  intent but valid ARB).
- Explicit non-goals: select/selectordinal, offset, exact-value selectors,
  nested/mixed ICU messages, # and | quoting, placeholder metadata.
  PO msgid_plural and XLIFF plural groups remain unsupported/rejected
  exactly as before.
- Verified: unit specs for the parser/emitter (subset parse, quoting,
  eight rejection shapes, export roundtrip), plus real PG + HTTP in
  formats-test (import upgrade/forms/value, ICU export, roundtrip, five
  rejection cases, brace-quoting roundtrip) and plural-test (import
  upgrade, export, plain-import preservation, missing-other per-key
  failure). The pre-existing ARB ICU rejection spec was updated to the new
  behavior, and the export endpoint summary names the normalization.
