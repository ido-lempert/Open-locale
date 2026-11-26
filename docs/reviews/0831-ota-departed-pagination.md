# Departed OTA bundle pagination guard

## Developer
changePage now refuses after destruction before signal mutation. Active
bounded pagination unchanged. Four captured-delta units preserve page/rows/
query/feedback and make no reads. Browser uses actual loaded51-row publication,
clears query and sets last page before departure, then captured previous call
cannot move it. No synthetic rows needed for browser lifecycle proof.

## Product
Read-only retained publication stays read-only. Scope/pin/export behavior
unchanged; no live editor changes, publication or client delivery claim.
Fix aligns pagination with existing departed search/filter/download guards.

## Designer
No UI/layout/copy change. Existing actual next/previous controls and narrow
bundle/download scope assertions rerun. No new screenshot inspection claim.

## Security
Stale captured handler cannot mutate departed local page state. Not a network
cancellation claim. No provider/worker/license/spend/share/scope change.

## QA/integration
OTA5 suites49 tests pass. Removing guard fails all4 targeted departure cases;
restored5/49 green. Actual download browser10/0, bundle browser25/0, final
first-attempt green after strengthening browser to actual retained rows.
Production web build passes1/2 cache; docs4checks138routes, syntax/diff clean.
No full-web/all-backend/native/sync/provider acceptance claim. Latest whole-web
761313suites3847tests. Coverage22FULL/7PARTIAL/1MISSING, defaultOFF/external
gaps unchanged. Five perspectives completed before commit, no scoped findings.
