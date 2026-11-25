# Fail-closed missing-selection browser verification

## Developer
Missing MT locale/provider suites require completed assertions and retain
nonzero exit if startup cleanup stops early. Existing caught-abort counters
stay intact. Configurable PostgreSQL port supports real harness; child Nx
daemon disabled consistently.

## Product
Test-only. No missing-choice display, exact retained IDs, draft preservation,
metadata refresh or active/inactive rule selection behavior changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable isolated fixtures and harness-owned listener only. No live accounts
changed or translation runs. Existing no-unrelated-effects checks preserved.
No service, registration, token scope, spend, worker, sharing or license changes.

## QA and integration
- Real occupied-port startup harness6/0 after negative probe.
- Original locale-missing exit with caught-abort counter intact reproduces zero
  exit and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual locale14/provider14 browser28/0 clean exits.
- Inventory finds no settings browser script without completion marker; this
  is not a claim that all previously guarded scripts were rerun in this slice.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
