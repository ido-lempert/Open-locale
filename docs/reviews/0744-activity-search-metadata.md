# Type-safe loaded activity metadata search

## Developer
Search verifies string fields before locale case folding. Action-label lookup
in this projection receives strings only. Existing valid label lookup, missing
actor fallback, literal matching, full loaded arrays and local sort unchanged.

## Product
Malformed actor/action/key/locale metadata cannot break filtered activity or
become invented searchable text through coercion. Loaded-order and raw
allowlisted full-download behavior stay separate from local search.

## Designer
Inspected actual desktop and390px filtered-empty screenshots. Search/count and
empty guidance fit page without horizontal overflow. Existing header remains
sticky. No new unfiltered malformed-rendering or layout claim.

## Security
No nonstring case methods or object text coercion in search projection. Detail
and private errors remain excluded from search/download. No new service,
registration, token scope, spend, worker or license change.

## QA and integration
- Full web295 suites/3,657tests (136/1,813 +159/1,844).
- Negative removal of string case guard fails6 malformed cases,1 valid case
  still passes. Fixed version restored before complete green runs.
- Actual metadata8/order12/download11 browser31/0, all clean exits.
- Browser fixtures malformed actor/key/locale fields; unit cases also cover
  malformed action. Raw allowlisted metadata and local clear verified.
- Production web build, cached API build, docs4/138routes, syntax/diff pass.
- Not whole-product/native/sync/external acceptance. Coverage22 FULL/7 PARTIAL/
  1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
