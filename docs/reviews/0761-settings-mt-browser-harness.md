# Fail-closed MT-settings browser verification

## Developer
Refresh/name-discard/pending-draft/name-validation require completed assertions
and retain nonzero exit if startup cleanup stops early. Existing caught-abort
counters remain intact. Configurable PostgreSQL port enables real harness;
child Nx daemon disabled consistently.

## Product
Test-only. No provider/profile Add, validation, local discard, accepted-write
receipt, draft preservation, metadata refresh or provider selection changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable local pseudo-provider fixtures and harness-owned listener only.
No pretranslation run, live provider calls or worker enablement. Existing
no-unrelated-effects checks preserved. No service, registration, token scope,
spend, sharing or license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Original name-discard exit with caught-abort counter intact reproduces zero
  exit and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual refresh13/name-discard8/pending11/name-validation12 browser44/0,
  clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
