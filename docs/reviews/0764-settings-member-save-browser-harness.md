# Fail-closed member-save and locale-validation browser verification

## Developer
Member role/locales explicit-save and member/group locale-validation suites
require completed assertions and retain nonzero exit if startup cleanup stops
early. Existing caught-abort counters stay intact. Configurable PostgreSQL port
enables real harness; child Nx daemon disabled consistently.

## Product
Test-only. No membership role/scope save, Add validation, accepted-write receipt,
draft preservation or metadata refresh behavior changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable isolated permission fixtures and harness-owned listener only. No live
grants changed. Existing effective/direct-scope and unrelated-effect assertions
preserved. No service, registration, token scope, spend, worker, sharing or
license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Original member-role exit with caught-abort counter intact reproduces zero
  exit and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual member-role13/member-locales17/member-validation19/group-validation19
  browser68/0 clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
