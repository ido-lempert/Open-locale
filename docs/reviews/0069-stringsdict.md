# 0069 - iOS .stringsdict (slice 5: second plural-aware format)

The iOS .stringsdict format gains a deliberately narrow plural subset,
unblocking the deferral recorded in 0060 ("stringsdict becomes implementable
once plural-aware key metadata lands" - it landed in slices 1-4):

- Import: <key>name</key><dict> entries whose NSStringFormatSpecTypeKey is
  NSStringPluralRuleType, with CLDR category <key>cat</key><string>text</string>
  pairs. NSStringFormatValueTypeKey is accepted and ignored. An imported
  entry UPGRADES the key to isPlural=true and writes pluralForms through the
  same import machinery Android uses (per-key validation against the target
  locale's CLDR set, per-key failure semantics, lock/snapshot behavior
  unchanged); the plain value carries the "other" form. A missing "other"
  form fails that key, consistent with the write API's 400. Whole-import
  rejections (400): missing <plist> root, non-plural spec type, unknown dict
  keys (width variants, nested specs), duplicate categories, inner markup,
  and DOCTYPE/entity declarations - rejected, never silently dropped,
  consistent with the other XML formats. A .strings import for a plural key
  preserves stored forms (slice 2 preservation contract), unchanged.
- Export: keys with isPlural and at least one stored form emit a plist
  entry with categories in canonical CLDR order; a plural key without
  stored forms in the exported locale is omitted entirely (a stringsdict
  entry without categories would be invalid). The emitter omits the plist
  DOCTYPE so its own output re-imports under the no-DOCTYPE rule; output is
  valid XML and round-trips.
- Explicit non-goals: width variants, nested dicts and multi-variable
  format specs stay rejected; PO msgid_plural, ARB ICU messages and XLIFF
  plural groups remain unsupported/rejected exactly as before. No other
  format reads or writes pluralForms yet beyond Android (slice 4).
- Verified over real PG + HTTP in formats-test (import upgrades metadata
  and writes forms, value=other, export emits ordered plist entries,
  export->import roundtrip, locale-without-forms omission, five 400
  rejection cases, branch scoping) and plural-test (import upgrade,
  export, .strings-import preservation, missing-other per-key failure).
