# Own report count entries

## Developer
Central ownCount projection requires own count-map property. Progress workflow,
quality type and fixed task status summary use it. Nullish own/missing counts
retain zero behavior. Own values are preserved, not sanitized or recomputed.
Raw report storage and downloads untouched.

## Product
A status/type present on one row must not display inherited function/object on
another row where absent. Missing stays zero, actual own count stays exact even
for inherited object names. Locale filter does not change totals/download scope.
This is not a new report count-validation or data-repair feature.

## Designer
Inspected desktop and390px real browser screenshots: progress own3/4/5/6 and
absent0/0/0/0 readable, QA rows same values, task missing statuses zero. Narrow
QA table far-right scroll clips locale by design; count cells visible. Existing
QA header spacing is tight, no unrelated typography improvement claimed. No
new overflow or layout changes from count projection.

## Security
Inherited values excluded without source mutation. Own __proto__ parsed from
JSON preserved as count data, not assigned into objects. No provider, spend,
registration, credential scope, worker, sharing or license change. Display
hardening, not prototype-pollution exploit claim.

## QA and integration
-14 new units:7 absent,5 own named counts, nullish/zero/state, ordinary inherited.
- Old expression negative6 fail/8 pass; fixed restored.
- Full web304 suites/3759 tests green136/1826 +168/1933, separately bounded.
- Actual browser9/0: progress/QA cross-row counts, task zeros, no inherited text,
 390px fit, filter zeros, exact raw full download, unchanged sources/no traffic,
 no runtime errors. Real disposable API/PostgreSQL; report states injected.
- First browser startup timed out, clean rerun with Nx daemon disabled. Expected
 data object transport dropped __proto__ in comparison, resulting two failures.
 Changed fixture evidence transport to JSON string; app raw download correctly
 retained own __proto__ throughout. Full browser rerun green.
- Production web/API builds, docs4/138routes, syntax/diff pass.
- No whole-product/native/sync/provider rerun claim. Coverage22 FULL/7 PARTIAL/
 1 MISSING and external acceptance gaps unchanged.

Five review passes complete, fixture names/evidence transport corrected.
