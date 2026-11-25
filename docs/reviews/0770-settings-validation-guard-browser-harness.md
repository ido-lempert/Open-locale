# Fail-closed validation-settings guard browser verification

## Developer
Group validation, rule payload validation, missing rule locales and webhook-copy
suites require completed assertions and retain nonzero exit if startup cleanup
stops early. Existing caught-abort counters stay intact. Configurable PostgreSQL
port enables real harness; child Nx daemon disabled consistently.

## Product
Test-only. No validation, missing-target handling, accepted-write receipt,
draft preservation or clipboard-result fencing behavior changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable isolated fixtures and harness-owned listener only. No live accounts
changed, fixture webhooks removed. Existing secret/clipboard, raw payload and
unrelated-effect checks preserved. No service, registration, token scope, spend,
worker, sharing or license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Original group-validation exit with caught-abort counter intact reproduces
  zero exit and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual group10/payload14/missing-target14/webhook-copy19 browser57/0,
  clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
