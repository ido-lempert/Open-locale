# Report project-reuse export regression

## Developer
Two unit cases settle both old dashboard reads after loadProject completes,
one with successes and one with failures. Current payload, readiness, windows
and feedback remain unchanged. Browser holds real usage/task requests across
same-component route reuse, then releases old success and injected503 failure.
No application change needed.

## Product
Actual downloaded JSON after old responses exactly equals the current empty
project download, with reset thirty-day window and independent task cutoff.
No old project figures or failure can relabel current project scope.
Download still does not fetch newer server state or share a file.

## Designer
Existing390px download/scope viewport check passes. No layout/copy changes,
new screenshot or changed-pixels claim. This is lifecycle coverage only.

## Security
Old503 private body never becomes current feedback or export data. Existing
whitelist/private-content assertions still pass. All fixture traffic remains
local. No external provider, worker, license, spend, share or scope change.

## QA/integration
Reports7 suites96 tests pass. Project-download browser18PASS/0FAIL, first try:
held old requests, reused current project, old success/failure, exact actual
file equality, deliberate stale-window negative and restoration included.
Docs4 checks138routes, script syntax and diff clean. No new build/full-web/
all-backend/native/sync/provider acceptance claim. Broader reports checkpoint
755 remains7browser flows91 checks, backend118, reports harness21.
Coverage22 FULL/7 PARTIAL/1 MISSING, workers defaultOFF and external acceptance
unchanged. Five review perspectives complete, no scoped findings before commit.
