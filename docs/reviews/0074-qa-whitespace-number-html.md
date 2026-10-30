# 0074 - QA: whitespace, number and HTML checks (slice 10)

Completes the planned QA check family (PLAN.md phase 1: "placeholder
mismatch, length limits, whitespace, number and HTML checks"). All run
per source/target text pair - the plain value and, for plural keys, every
category form (slice 9 machinery, now shared through one checkPair
helper):

- whitespace: leading or trailing whitespace presence differs between
  source and target (detail names which side and which end).
- number_mismatch: digit-sequence tokens (optional decimal part) compared
  as sorted multisets; a translated number that changed or vanished is
  flagged with both token lists.
- html_mismatch: HTML tags compared as sorted multisets of lowercased tag
  names with closing markers; attributes and tag case are ignored.
- New issue types extend the QA response union (additive; no existing
  type or detail shape changed). The QA page labels and badge colors were
  added for all three.
- Conservative scope: these are pairwise source-vs-target comparisons,
  matching the existing checks' anchoring; no target-side-only linting
  (double spaces, unclosed tags in one side alone) is attempted.
- Verified: qa-test 23 legs (+7: whitespace flagged only on the differing
  locale with the side named, numbers, HTML with attribute/case
  insensitivity, per-category number check with the category named, and a
  source-forms PUT guard) at real PG + HTTP; e2e-visual 219 checks (+2)
  drives a number-mismatch key through the editor to the QA page and
  asserts the new badge label renders (editor-49-qa-number.png,
  OCR-verified). One interim e2e-visual FAIL disclosed: the first version
  of the leg addressed the grid row by index and typed into the wrong key
  (grid sorts by name; a third pre-existing key shifted indices) - fixed
  to locate the row by key text. Test-fixture fix, no application change.
