# Fail-closed webhook-settings browser verification

## Developer
Refresh/URL-discard/pending-draft/hide require completed assertions and retain
nonzero exit when startup cleanup stops early. Existing caught-abort counters
stay intact. Configurable PostgreSQL port supports real harness; child Nx
daemon disabled consistently.

## Product
Test-only. No webhook creation/deletion/toggle, event selection, one-time reveal,
hide, local drafts, metadata refresh or accepted-write receipt changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable local fixtures only; no live webhook changes or external delivery.
No deliveries enqueued/attempted, disposable webhooks removed. Existing signing
secret retention/hide and unrelated-effect checks preserved. No service,
registration, token scope, spend, worker, sharing or license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Original URL-discard exit with caught-abort counter intact reproduces zero
  exit and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual refresh14/URL-discard8/pending13/hide16 browser51/0 clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
