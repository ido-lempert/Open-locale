# Fail-closed origin-settings browser verification

## Developer
Refresh/discard/pending-draft/validation require completed assertions and retain
nonzero exit when startup cleanup stops early. Existing caught-abort counters
stay intact. Configurable PostgreSQL port supports real harness; child Nx
daemon disabled consistently.

## Product
Test-only. No origin validation, Add, local discard, accepted-write receipt,
draft preservation, metadata refresh or allowed-origin behavior changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable local fixtures and harness-owned listener only. Refresh never contacts
listed origins or outside hosts. Existing no-unrelated-effects checks preserved.
No service, registration, token scope, spend, worker, sharing or license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Original discard exit with caught-abort counter intact reproduces zero exit
  and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual refresh18/discard7/pending13/validation23 browser61/0 clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
