# Fail-closed resource-removal browser verification

## Developer
Webhook/rule/provider/locale removal suites require completed assertions and
retain nonzero exit if startup cleanup stops early. Existing caught-abort
counters remain intact. Configurable PostgreSQL port supports real harness;
child Nx daemon disabled consistently.

## Product
Test-only. No removal confirmation, accepted-write receipt, local draft
preservation, cascade scope or metadata refresh behavior changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable isolated deletion/cascade fixtures and harness-owned listener only.
No live settings changed or workers enabled. Existing targeted deletion,
translation preservation and unrelated-effect assertions retained. No service,
registration, token scope, spend, sharing or license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Original webhook-delete exit with caught-abort counter intact reproduces zero
  exit and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual webhook13/rule11/provider12/locale15 browser51/0 clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
