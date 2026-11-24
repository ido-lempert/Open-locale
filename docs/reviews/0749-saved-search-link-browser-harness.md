# Fail-closed saved-search branch and local result verification

## Developer
Linked-branch/loaded-key/loaded-key-clear/report-context now require explicit
completion with counted caught aborts and exit guards. Configurable PostgreSQL
port supports real startup harness. Child Nx daemon disabled, assertions kept.

## Product
Test-only. No application branch handoff, local key filtering/reset, keyboard
focus, report context/download or stale-response behavior change.

## Designer
No application visual change. Existing desktop/mobile and keyboard paths rerun
without new visual acceptance claims. Harness separates startup abort, nonzero
exit and no application PASS assertions.

## Security
Isolated disposable fixtures and harness-owned listener. Existing branch scope,
private stale-response and loaded-context download limits retained. No new
service, registration, token scope, spend, worker or license change.

## QA and integration
- Actual occupied-port startup harness12/0, repeated after negative probe.
- Original linked-branch catch/exit restoration reproduces zero-exit abort,
  exactly1 targeted harness failure. Fixed version restored.
- Empty selection rejects. Actual branch13/key15/key-clear11/report16:
  browser55/0, clean exits.
- Cached API build, docs4/138routes, syntax/diff pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
