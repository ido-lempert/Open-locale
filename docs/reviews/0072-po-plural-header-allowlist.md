# 0072 - PO plural import: reviewed-header allowlist (slice 8)

Slice 8 replaces the derived slot-to-category mapping of 0071. The derived
approach evaluated the file's own Plural-Forms C expression for n=0..200
and claimed consistency from the sample; that sampling could not prove
consistency beyond the probed range (an expression can agree on 0..200 and
diverge later), so the claim is retracted and the mechanism removed from
the import path.

- Import allowlist: a plural import now requires the file's Plural-Forms
  header to match PO_IMPORT_PLURAL_HEADERS exactly, modulo whitespace
  (canonicalization strips all whitespace; it is insignificant in the C
  expression grammar accepted here, which has no string literals). Each
  listed expression is a reviewed, documented standard gettext header and
  carries its slot->category mapping as reviewed data. Untrusted file
  expressions are never evaluated on import. Canonical equivalence is
  explicit: only whitespace variants of a listed header match; different
  parenthesization or equivalent-but-rewritten expressions do not.
- Fail-closed rejections (400): unparseable headers, expressions not on
  the list (including arbitrary million-range rules), a listed expression
  under a different nplurals count, locale-ambiguous headers imported into
  a locale they do not cover, and headers whose slots have no 'other'
  category - the standard Russian and Polish rules are not listed, so
  those files still cannot import (unchanged posture, now enforced by
  absence from the allowlist rather than by derived-mapping failure).
- Locale-ambiguous headers: the shared Latvian/Lithuanian standard header
  (same expression, different slot meanings) resolves by import target
  locale (lv -> one/other/zero, lt -> one/few/other); importing it into
  any other locale is rejected with the supported locales named.
- Import/export asymmetry, now explicit: import needs only an 'other'
  slot to place every form correctly, so the allowlist accepts headers
  that do not cover every CLDR category of a locale (Czech/Slovak,
  Irish, Lithuanian standard rules). The export table stays stricter
  (must cover every category, so those locales are absent from it) and is
  unchanged. A standard header from another locale family (e.g. an
  English nplurals=2 file imported into Hebrew) is accepted: the reviewed
  mapping is locale-independent and the resulting {one, other} forms are
  validated against the target locale's CLDR categories per key, as for
  every other format. The 0071 "header inconsistent with target locale"
  rejection applied only to the derived-mapping approach and no longer
  exists; the formats-test leg now asserts the accepted cross-locale
  import and the allowlist rejections.
- Verification harness, not proof: slotCategories/evalPluralExpr remain
  only to regression-check the reviewed data (export table entries and
  allowlist entries) against Intl.PluralRules on n=0..200. That check
  guards the reviewed table against typos; it is not a correctness proof
  for general expressions, and no general-expression claim is made.
- Chronology correction: in slice 7 the Irish (ga) export-table entry was
  caught shipping a non-standard expression by the new table-verification
  unit test and corrected before commit. That entry was production table
  data (PO_PLURAL_FORMS), so this was a production-data defect caught
  pre-commit by the new verification, not a test-fixture fix.
- Verified: unit specs (allowlist resolution incl. spelling variants and
  lv/lt disambiguation, fail-closed rejections incl. the Russian rule,
  regression check of every allowlisted header against Intl.PluralRules,
  export-table importability invariant, plus the pre-existing parser,
  evaluator and table-verification specs), and real PG + HTTP in
  formats-test (cross-locale header accepted with mapped forms, Russian
  rule 400, out-of-allowlist expression 400, slot-count 400, plus the
  unchanged import/export/roundtrip legs). plural-test unchanged (its
  en header is allowlisted).
