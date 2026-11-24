# Fail-closed editor create/delete browser verification

## Developer
Four existing key-create/key-delete/delete-confirm/locale-create suites gain
explicit completion and exit-event guards. Existing caught-abort counters remain;
this adds defense against cleanup exit-code resets and future counter regressions.
Assertions remain unchanged. Child Nx daemon disabled; existing process-group
cleanup retained. Configurable PostgreSQL port supports real startup failure test.

## Product
Test infrastructure only. No application create/delete semantics, confirmation,
translation autosave, local draft, refresh or retry behavior changes. No claim
that these four original caught-abort counters were themselves broken.

## Designer
No application visual change. Harness distinguishes real startup abort, nonzero
exit and absence of application PASS assertions. Actual browser reruns exercise
existing desktop/mobile flows; no new visual acceptance claim.

## Security
Isolated disposable local databases and harness-owned occupied listener only.
No external provider requests, credential expansion, registration, spend, worker
activation or license decision. No production data involved.

## QA and integration
- Actual occupied-PostgreSQL-port harness: four suites x three checks =12/0.
- Negative probe removes key-create completion/exit and caught-abort safeguards:
  exactly one failed harness check detects actual zero-exit startup abort.
  Restored then harness12/0 again.
- Unmatched selection rejects rather than reporting empty success.
- Actual key-create5/key-delete4/delete-confirm12/locale-create5 browser26/0.
- API build cached. Syntax/diff and docs consistency checked. Application code
  unchanged; application build and unit suites not rerun.
- Not whole-product/native/sync/external acceptance. Coverage22 FULL/7 PARTIAL/
  1 MISSING and standing external acceptance gaps unchanged.

All five review passes complete with no remaining scoped issue.
