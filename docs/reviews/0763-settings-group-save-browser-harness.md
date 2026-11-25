# Fail-closed explicit group-save browser verification

## Developer
Role/locales/name/member explicit-save suites require completed assertions and
retain nonzero exit if startup cleanup stops early. Existing caught-abort
counters stay intact. Configurable PostgreSQL port supports real harness;
child Nx daemon disabled consistently.

## Product
Test-only. No group role/scope/name/member save, accepted-write receipt, draft
preservation or metadata refresh behavior changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable isolated grant/permission fixtures and harness-owned listener only.
No live grants changed. Existing effective/direct-scope and unrelated-effect
assertions preserved. No service, registration, token scope, spend, worker,
sharing or license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Original role-save exit with caught-abort counter intact reproduces zero exit
  and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual role12/locales17/name15/member13 browser57/0 clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
