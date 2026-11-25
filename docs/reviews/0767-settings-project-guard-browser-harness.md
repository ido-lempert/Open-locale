# Fail-closed project-settings guard browser verification

## Developer
Status/origin removal, project deletion and General-validation suites require
completed assertions and retain nonzero exit if startup cleanup stops early.
Existing caught-abort counters stay intact. Configurable PostgreSQL port enables
real harness; child Nx daemon disabled consistently.

## Product
Test-only. No removal/deletion confirmation, accepted-write receipt, validation,
local draft preservation or metadata refresh behavior changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable isolated settings/deletion fixtures and harness-owned listener only.
No live projects or settings changed. Existing targeted changes, translation
preservation and unrelated-effect checks retained. No service, registration,
token scope, spend, worker, sharing or license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Original status-remove exit with caught-abort counter intact reproduces zero
  exit and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual status14/origin14/project11/General-validation10 browser49/0,
  clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
