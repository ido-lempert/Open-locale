# Type-safe retained OTA value search

## Developer
Retained value-text matching checks string type before case folding. Valid
key matching remains independent, and empty query retains the original array.
No bundle loading, publication identity, pagination or download-scope changes.
This is not validation of entire malformed bundles or nonstring display repair.

## Product
Malformed retained values cannot break a local search or become invented
search text. Original loaded values and full download remain unchanged.
Existing exact empty-string classification is deliberately not redefined.

## Designer
Inspected actual desktop and390px full-page screenshots. Search, filtered counts,
retained-only scope and empty guidance wrap without horizontal overflow. No new
unfiltered malformed-display acceptance claim.

## Security
No nonstring case call or object-text coercion for search. No new API request
or mutation from local filtering. No service, registration, scope expansion,
spend, worker enablement, sharing or license choice.

## QA and integration
- Full web300 suites/3,692tests pass (136/1,810 +164/1,882).
- Restored unsafe original value matching fails7/7 targeted tests; fixed
  version restored before full green runs.
- Actual metadata10/value-filter11/download9 browser30/0 clean exits.
- Metadata fixtures install raw loaded values locally; persisted publication
  regressions verify full51-value download, refresh, route reset and departure.
- Raw null/numeric/array values retained in downloaded bundle despite no match.
- Production web build, cached API build, docs4/138routes, syntax/diff pass.
- Not whole-product/native/sync/external acceptance. Coverage22 FULL/7 PARTIAL/
  1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
