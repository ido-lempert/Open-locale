# Nonempty departed report reset browser proof

## Developer
Departure fixture previously had cleared searches, allowing missing reset
guard to pass. Now types both real inputs, captures all report object
identities, scope and notices, then calls captured download/query/reset/three
refresh callbacks after departure. Exact state and read count must remain.
No application change.

## Product
Evidence correction only. Local searches, current dashboards, downloaded
scope and active controls unchanged. No new feature claim.

## Designer
No UI/copy/layout change or screenshot inspection claim. Actual search inputs
used before departure;763 contains inspected reset screenshots.

## Security
Isolated actual browser removal of reset guard fails targeted departure
assertion28PASS/1FAIL, restored29/0. No false proof from empty initial state.
Existing raw private-data exclusions and stale-response checks retained. No
worker/provider/license/spend/share/credential-scope changes.

## QA/integration
Reports9 suites109 tests pass. Strengthened initial browser29/0, negative28/1,
restored29/0 explicit exits verified. Docs4checks138routes, syntax/diff clean.
No new build/full-web/all-backend/native/sync/provider acceptance claim. Latest
whole-web761313suites3847tests. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF/
external gaps unchanged. Five review perspectives complete before commit,
no scoped findings remain. Publication changes test/docs only.
