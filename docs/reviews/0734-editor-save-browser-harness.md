# Fail-closed editor save browser verification

## Developer
Four suites gain completion/exit checks. Save-version/review-version/draft-save
also increment caught-abort failures instead of relying on mutable exitCode.
Child Nx daemon off, configurable PostgreSQL port; assertions/cleanup retained.

## Product
Test-only. No application concurrency, save, review, local draft, reload or replay
change. Existing save-recovery-focus abort counter retained.

## Designer
No application visual change. Harness distinguishes actual abort, nonzero exit
and no application PASS assertions. Existing desktop/mobile flows rerun, without
new visual acceptance claims.

## Security
Disposable isolated databases and harness-owned occupied listener. No new service,
credential scope, registration, spend, worker or license. Conditional save/review
identity and recovery guards unchanged.

## QA and integration
- Actual occupied-port startup harness12/0.
- Restoring original save-version catch/exit behavior reproduces zero-exit abort,
  exactly1 harness failure; fixed version restored then12/0 again.
- Unmatched selection rejects. Actual save-version11/review-version13/draft-save4/
  save-recovery-focus5 browser33/0.
- API cached/docs4/138routes/syntax/diff pass. Application build/units not rerun.
- Not whole-product/native/sync/external acceptance. Coverage22 FULL/7 PARTIAL/
  1 MISSING and external gaps unchanged.

All five review passes complete with no remaining scoped issue.
