# Fail-closed editor file-scope browser verification

## Developer
Four file-scope suites gain explicit completion/exit checks. Existing caught-abort
counters/assertions stay. Child Nx daemon disabled; configurable PostgreSQL port
supports actual startup-abort probes. Process-group cleanup unchanged.

## Product
Test-only reliability. No application export/import/backup/bundle scope, local
draft, capture, refresh or replay change. Original caught-abort counters existed;
no claim that these four unmodified scripts reproduced false-success startup.

## Designer
No application visual change. Harness distinguishes real abort, nonzero exit and
no application PASS assertions. Existing desktop/mobile flows rerun without new
visual acceptance claims.

## Security
Disposable isolated local databases and harness-owned listener only. No external
service, credential scope, registration, spend, worker activation or license
change. Existing file content and private project handling unchanged.

## QA and integration
- Four actual occupied-port startup cases,12/0 checks.
- Negative probe removes export completion/exit and caught-abort safeguards:
  exactly1 failure detects zero-exit abort, restored then12/0 again.
- Unmatched selection rejects rather than empty success.
- Actual export6/import5/backup11/bundle5 browser27/0.
- API cached; docs4/138routes/syntax/diff pass. Application code unchanged;
  application build/units not rerun. Not whole-product/native/sync/external
  acceptance. Coverage22 FULL/7 PARTIAL/1 MISSING and external gaps unchanged.

All five review passes complete with no remaining scoped issue.
