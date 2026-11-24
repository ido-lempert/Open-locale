# Fail-closed editor draft-download browser verification

## Developer
Four suites gain completion/exit checks, retaining original abort counters and
assertions. Child Nx daemon off; configurable PostgreSQL port for actual startup
probe. Existing process-group and temporary-download cleanup preserved.

## Product
Test-only reliability. No application local-backup/retained-download/scope/export
focus, translation autosave, draft or read behavior changes. Original abort
counters existed; no claim of unmodified false success in these four suites.

## Designer
No application visual change. Harness distinguishes actual startup abort,
nonzero exit and absence of application PASS assertions. Existing desktop/mobile
flows rerun; no new visual acceptance claim.

## Security
Disposable isolated local databases and harness-owned occupied listener. No new
external service, credential scope, spend, registration, worker or license.
Local file/private project handling unchanged.

## QA and integration
- Four actual occupied-port startup cases,12/0 checks.
- Negative probe removes local-backup completion/exit and caught-abort guards:
  exactly1 zero-exit failure detected, restored then12/0 again.
- Unmatched selection rejects rather than empty success.
- Actual local-backup8/retained-download8/collapsed-scope18/export-focus8 =42/0.
- API cached; docs4/138routes/syntax/diff pass. Application code unchanged;
  application build/units not rerun. Not whole-product/native/sync/external
  acceptance. Coverage22 FULL/7 PARTIAL/1 MISSING and external gaps unchanged.

All five review passes complete with no remaining scoped issue.
