# Fail-closed automation-settings guard browser verification

## Developer
MT/OTA branch-refresh and provider/rule toggle suites require completed
assertions and retain nonzero exit if startup cleanup stops early. Existing
caught-abort counters stay intact. Configurable PostgreSQL port enables real
harness; child Nx daemon disabled consistently.

## Product
Test-only. No branch selection, retained missing choices, explicit enable/disable,
accepted-write receipt, draft preservation or metadata refresh behavior changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable isolated fixtures and harness-owned listener only. No live workers,
providers or settings changed, provider calls or automation effects. Existing
state fencing and unrelated-effect assertions retained. No service, registration,
token scope, spend, sharing or license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Original MT-branch-refresh exit with caught-abort counter intact reproduces
  zero exit and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual MT-branches14/OTA-branches14/provider-toggle11/rule-toggle11
  browser50/0 clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
