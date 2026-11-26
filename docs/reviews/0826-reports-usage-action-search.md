# Loaded usage action-code search

## Developer
Local bounded signal and literal case-insensitive code filter, no server
query. Explicit usage refresh/window changes retain query; project load resets
it. Destroyed callback fenced. Raw actionRows/export unchanged. Four new unit
cases, reports8 suites102 tests. Filter-removal probe fails1/3pass; restored
8/102 green. No raw actor/count search or source mutation.

## Product
Search affects loaded usage action codes only. Count/filtered-empty guidance
says loaded codes, not absent activity. Event totals, actors, task dashboard
and complete downloaded byAction stay unchanged, with no extra requests.
Clear local search restores all codes. Independent branch locale search stays.

## Designer
Inspected desktop1280-wide and mobile390-wide full-page pixels, rendered to
fit preview. Added top spacing on Clear button after first inspection so its
border does not touch focused input outline. Updated pixels verified: scope,
count and empty-state wrap readably; actor/task sections remain visible.

## Security
Literal includes,200-character bound, no regex/HTML evaluation. Only action
codes searched, not actor metadata or private task/translation content. No
provider/worker/license/spend/share/scope change.

## QA/integration
Project-dashboard browser22/0 clean explicit exit0: real action match, literal
no-match, clear, refresh retention, raw full export, reused project reset,
departed callback plus existing old-response checks. Refresh browser18/0.
Initial script syntax error fixed before startup. Next7PASS then missing file
from coordinate download click after new lower-page focus; DOM activation of
actual download control fixes scroll timing, generated file still read exactly.
One combined build/test invocation emitted detached-child cleanup warning
after22PASS; standalone rerun22PASS exit0 confirmed. Web production build
passes (1/2 cache), docs4checks138routes, syntax/diff clean.
No whole-web/all-backend/native/sync/provider acceptance claim. Coverage22FULL/
7PARTIAL/1MISSING, workers defaultOFF and existing external gaps unchanged.
Five review perspectives complete before commit, no scoped findings remain.
