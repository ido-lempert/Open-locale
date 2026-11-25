# Fail-closed access-removal browser verification

## Developer
Member/group/group-member removal and token-revocation suites require completed
assertions and retain nonzero exit if startup cleanup stops early. Existing
caught-abort counters stay intact. Configurable PostgreSQL port enables real
harness; child Nx daemon disabled consistently.

## Product
Test-only. No removal/revocation confirmation, accepted-write receipt, local
draft preservation, team-wide scope or metadata refresh behavior changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable isolated permission/revocation fixtures and harness-owned listener
only. No live accounts changed. Existing authentication, inherited grants,
assignments, translation preservation and unrelated-effect assertions retained.
No service, registration, token scope, spend, worker, sharing or license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Original member-removal exit with caught-abort counter intact reproduces zero
  exit and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual member16/group17/group-member17/token15 browser65/0 clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
