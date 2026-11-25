# Fail-closed form and production-route browser verification

## Developer
Form backup/reset edit-revert and production-route suites require completed
assertions and retain nonzero exit if startup cleanup stops early. Add missing
caught-abort counters. Configurable PostgreSQL port enables real harness;
child environment disables Nx daemon consistently.

## Product
Test-only. No backup/reset, accepted receipts, form edit-revert, route loading
or failed-navigation recovery behavior changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable isolated fixtures and harness-owned listener only. No live account
changes. Existing private-download/error-detail, draft retention and chunk
failure checks preserved. No service, registration, token scope, spend, worker,
sharing or license changes.

## QA and integration
- Real occupied-port startup harness9/0 after negative probe.
- Original backup exit behavior with new caught-abort counter retained reproduces
  zero exit and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual backup17/reset17/production-routes22 browser56/0 clean exits.
- Production routes include actual blocked lazy chunk and retained-draft recovery.
- No browser-test.mjs lacks completion marker by inventory. This is not a claim
  that all previously guarded browser scripts were rerun in this slice.
- Production web build, cached API build, docs4/138routes, syntax/diff pass.
- No application unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
