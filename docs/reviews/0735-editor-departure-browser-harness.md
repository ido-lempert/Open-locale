# Fail-closed editor departure browser verification

## Developer
Branch-drafts/filter-drafts/search-departure/branch-unknown gain explicit
completion and process-exit guards, counted caught aborts and daemon-off child
servers. Configurable PostgreSQL ports allow a real occupied-port harness.
Existing assertions, debug screenshots/body capture and cleanup remain intact.

## Product
Test-only. No application branch switching, filtering, draft save, navigation,
branch creation or unknown-outcome recovery behavior changes.

## Designer
No application visual changes. Existing desktop/mobile paths rerun, without
new visual acceptance claims. Harness labels separate startup abort, failed
exit and absence of application PASS assertions.

## Security
Disposable isolated database fixtures and harness-owned occupied listener.
No new service, credential scope, spend, registration, worker or license change.
Unknown writes remain non-replaying; fixture-only explicit reload unchanged.

## QA and integration
- Real occupied-port startup harness12/0, repeated after negative probe.
- Restoring original branch-drafts catch/exit behavior reproduces zero-exit
  startup abort, exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual branch-drafts10/filter-drafts12/search-departure10/branch-unknown7
  browser39/0, with clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun, whole-product/native/sync/external acceptance.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external gaps unchanged.

All five review passes complete with no remaining scoped issue.
