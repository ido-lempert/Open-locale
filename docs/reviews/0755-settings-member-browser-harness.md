# Fail-closed member-settings browser verification

## Developer
Refresh/discard/email-discard/pending-draft require completed assertions and
retain nonzero exit if startup cleanup stops early. Existing caught-abort
counters stay intact. Configurable PostgreSQL port supports real harness;
child Nx daemon disabled consistently.

## Product
Test-only. No membership save, grant scope, direct/inherited role, local draft,
metadata refresh, discard or accepted-write receipt changes.

## Designer
No application visual change. Existing desktop/mobile browser assertions rerun;
no new screenshot acceptance claim. Startup abort, nonzero exit and absence of
application PASS assertions are separate harness checks.

## Security
Disposable local database fixtures and harness-owned listener only. Existing
no-unrelated-mutations and grant-retention assertions preserved. No service,
registration, token scope, spend, worker, sharing or license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Restoring original discard exit with caught-abort counter intact reproduces
  zero-exit abort, exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual refresh16/discard12/email-discard9/pending14 browser51/0 clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
