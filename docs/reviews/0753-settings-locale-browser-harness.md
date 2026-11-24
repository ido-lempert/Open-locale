# Fail-closed locale-settings browser verification

## Developer
Code validation/discard/pending-draft/refresh now require completed assertions
and retain nonzero exit when startup cleanup stops early. Existing caught-abort
counters stay intact. Configurable local PostgreSQL port enables real harness;
child Nx daemon disabled consistently.

## Product
Test-only. No locale Add, local discard, accepted-write receipts, draft retention,
metadata refresh, locale removal confirmation or provider selection changes.

## Designer
No application visual change. Existing desktop/mobile browser assertions rerun;
no new screenshot acceptance claim. Harness distinguishes startup failure,
nonzero exit and absence of application PASS assertions.

## Security
Disposable local database fixtures and harness-owned listener only. Existing
no-unrelated-mutations assertions retained. No new service, registration, token
scope, spending, worker enablement or license changes.

## QA and integration
- Real occupied-port startup harness12/0, repeated after negative probe.
- Restoring original discard exit behavior with caught-abort counter intact
  reproduces zero-exit abort, exactly1 targeted harness failure. Fixed restored.
- Empty harness selection rejects rather than falsely passing.
- Actual validation20/discard7/pending13/refresh17 browser57/0 clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- First negative-check assertion counted diagnostic JSON text too; corrected
  to count only FAIL lines and reran the actual probe. Excluded setup attempt.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
