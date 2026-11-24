# Type-safe loaded report locale search

## Developer
Both progress and quality locale projections verify string type before case
folding. No source mutation or coercion; each independent report keeps its raw
loaded rows and valid literal case-insensitive code matching.

## Product
A malformed locale code cannot break filtered report tables. Counts and totals
retain full report meaning. Clear returns all loaded rows. Branch download
preserves original metadata, totals and both complete reports unchanged.

## Designer
Inspected actual desktop and390px filtered-empty screenshots. Search, scope and
counts wrap within page; existing internal progress-table horizontal scroll
retained. No new layout or unfiltered malformed-rendering acceptance claim.

## Security
No nonstring case method or object text coercion for search. No extra retrieval,
sharing, new service, registration, token scope, spend, worker or license change.

## QA and integration
- Full web294 suites/3,650tests (136/1,813 +158/1,837).
- Original unsafe projections restored in negative probe fail7/7 targeted
  cases, then fixed version restored before full green runs.
- Actual metadata9/search11/download6 browser26/0, clean exits. Metadata fixture
  installs loaded rows locally; existing search/download verify live API data.
- Production web build completed but initial command reported descendants;
  clean reaped cached build rerun passed. API build cached.
- Docs4/138routes, syntax/diff pass. No whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
