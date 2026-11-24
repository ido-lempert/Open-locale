# Fail-closed editor branch-write browser verification

## Developer
Four suites gain explicit completion/exit checks, retaining existing caught-abort
counters/assertions. Child Nx daemon off; configurable PostgreSQL port for real
startup probe. Existing child process-group cleanup retained.

## Product
Test-only reliability. No application merge/identity/branch validation/import
or local draft behavior change. Existing abort counters were present; no claim
these four unmodified scripts falsely succeeded on startup abort.

## Designer
No application visual change. Harness distinguishes actual abort, nonzero exit
and no application PASS assertions. Existing desktop/mobile flows rerun without
new visual acceptance claims.

## Security
Disposable isolated local databases and harness-owned occupied listener. No new
external service, credential scope, registration, spend, worker or license.
Existing merge confirmation, identity and replay protections unchanged.

## QA and integration
- Four actual occupied-port startup cases,12/0 checks.
- Negative probe removes merge completion/exit and caught-abort safeguards:
  exactly1 zero-exit failure detected, restored then12/0 again.
- Unmatched selection rejects rather than empty success.
- Actual merge5/merge-identity9/branch-name19/import-drafts5 browser38/0.
- API cached; docs4/138routes/syntax/diff pass. Application code unchanged;
  application build/units not rerun. Not whole-product/native/sync/external
  acceptance. Coverage22 FULL/7 PARTIAL/1 MISSING and external gaps unchanged.

All five review passes complete with no remaining scoped issue.
