# OTA local reset while retained refresh held

## Developer
Async unit holds actual reload promise, resets local view, then releases
retained bytes. Latest cleared query/filter/page stays cleared, exact scope
captured once. No app change needed.

## Product
Browser reset remains available while filters hidden by loading. It does not
cancel refresh or change publication pin. Response returns all51 retained
values, first50 shown, without resurrecting filters. Actual full download is
identical original retained payload, not newer editor values.

## Designer
No UI/copy/layout change or new screenshot inspection claim. Existing control
used while loading.768 has inspected reset screenshots.

## Security
No new reads or writes; retained private content remains scoped. Existing
pinned/legacy/download/departed checks rerun. No provider/worker/license/spend/
share/credential-scope change.

## QA/integration
OTA6 suites54 tests pass. Value-filter browser17/0 final, including three new
held-reset assertions and actual downloaded JSON equality. Initial web4200
startup timeout before any application PASS; cleanup verified, same command
retry17/0 explicit exit0. No product fix or unsupported root-cause assertion.
Docs4checks138routes, syntax/diff pass. No new build/full-web/all-backend/native/
sync/provider acceptance claim. Latest OTA checkpoint767sixflows74checks,
backend46. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five review perspectives complete before commit, no scoped findings remain.
