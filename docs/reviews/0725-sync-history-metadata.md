# Bound diagnostic caller-label metadata

## Developer
Nonempty string guard covers branch, locale, caller SHA and fingerprint. Fixed
unavailable labels prevent raw object/blank rendering. Search skips malformed
source fields instead of throwing, does not search fallback text. Valid strings
kept exact; loaded objects and raw diagnostic download unchanged.

## Product
Diagnostic-only history remains caller-supplied/unverified. No apply, baseline,
remote verification, extra read or write claim. Unknown caller metadata does not
hide records in all view. Clear recovers loaded rows without source repair.

## Designer
Actual desktop/390px screenshots inspected: bounded labels readable, headings
and metadata wrap without overflow. Valid markup-looking labels render as text,
not HTML. Existing diagnostic scope guidance retained.

## Security
Angular interpolation, no HTML insertion or arbitrary object coercion in selected
labels. Download remains local raw project metadata. No new service, credential,
scope, registration, spend, worker or license change.

## QA and integration
-32new units;286web files/3,561tests green in136/1,825 +150/1,736 stages.
- Removed search-guard mutation failed exactly1 selected numeric-branch check,
  restored before full green run.
- New browser8/0; existing search7/clear9 =16/0.
- Web compiled/API cached. Docs4/138routes/syntax/diff pass; existing bundle
  warning remains. No whole-product/native/sync/external acceptance claim.
- Coverage22 FULL/7 PARTIAL/1 MISSING and standing external gaps unchanged.

All five review passes complete with no remaining scoped issue.
