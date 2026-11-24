# Fail-closed group-settings browser verification

## Developer
Refresh/discard/name-discard/pending-draft require completed assertions and
retain nonzero exit if startup cleanup stops early. Existing caught-abort
counters remain intact. Configurable PostgreSQL port enables real harness;
child Nx daemon disabled consistently.

## Product
Test-only. No group creation, direct/inherited grants, membership, local drafts,
metadata refresh, discard or accepted-write receipt changes.

## Designer
No application visual change. Existing desktop/mobile browser assertions rerun;
no new screenshot acceptance claim. Harness separates startup abort, nonzero
exit and absence of application PASS assertions.

## Security
Disposable local database fixtures and harness-owned listener only. Existing
no-unrelated-mutations and direct-membership retention checks preserved. No new
service, registration, token scope, spend, worker, sharing or license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Original discard exit behavior with caught-abort counter intact reproduces
  zero-exit abort and exactly1 targeted harness failure. Fixed restored.
- Empty harness selection rejects.
- Actual refresh21/discard10/name-discard8/pending12 browser51/0 clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
