# Reset report local searches

## Developer
One guarded synchronous action clears both query signals only. Enabled for
either nonempty raw query, including whitespace. Preserves loaded object
identity, branch/window/project, feedback and loading/error flags. Four new
unit cases cover ready/pending/failed/destroyed. No server reads.

## Product
Control stays outside usage-data conditional so hidden query can be reset
while usage unavailable. Explicit text limits reset to local searches, not
reports or branch options. Existing individual clear controls retained.

## Designer
Inspected actual1280/390 full-page screenshots. Reset appears above locale
search, with local-only explanation; disabled state after reset clear. Mobile
text wraps within viewport and existing report tables scroll internally.
No overlapping controls; loaded usage codes and actors/tasks remain readable.

## Security
Destroyed reset refuses; no automatic replay/network effects. Both source
reports/download scopes unchanged. No provider/worker/license/spend/share/
credential-scope changes.

## QA/integration
Reports9 suites108 tests pass. Project-dashboard browser27/0 first attempt:
reset both queries with exact loaded identity/feedback and request count,
reset hidden failed usage query without clearing error, existing export guards.
Missing usage-reset mutation fails3 tests/1pass; restored9/108 green.
Production build passes1/2 cache via reaping wrapper. Initial wrong Nx JS
entrypoint did not build; corrected node_modules/.bin/nx build web exit0.
Docs4checks138routes, syntax/diff clean. No full-web/all-backend/native/sync/
provider acceptance claim. Latest whole-web761313suites3847tests.
Coverage22FULL/7PARTIAL/1MISSING, defaultOFF/external gaps unchanged.
Five review perspectives complete before commit, no scoped findings remain.
