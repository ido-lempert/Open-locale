# Fail-closed saved-search core browser verification

## Developer
Base/clear/cancel/focus suites gain explicit completion/exit guards and counted
caught aborts. Configurable PostgreSQL port enables actual occupied-port startup
harness; child Nx daemon disabled. Assertions and cleanup retained.

## Product
Test-only. No application query, scope, explicit search, cancellation, local
clear, privacy fencing or keyboard focus behavior changes.

## Designer
No application visual change. Existing desktop/mobile and keyboard paths rerun
without new visual acceptance claims. Harness labels distinguish startup abort,
nonzero exit and absence of application PASS assertions.

## Security
Isolated disposable local fixtures and harness-owned listener. No new service,
registration, spend, token scope, worker or license. Existing SQL-literal,
read-only, stale-response privacy and zero-write assertions retained.

## QA and integration
- Real occupied-port startup harness12/0, repeated after negative probe.
- Original base catch/exit restoration reproduces zero-exit startup abort,
  exactly1 targeted harness failure. Fixed version restored.
- Empty selection rejects. Actual base15/clear12/cancel14/focus10 browser51/0,
  all clean exits.
- Cached API build, docs4/138routes, syntax/diff pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
