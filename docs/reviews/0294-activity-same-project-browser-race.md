# 0294 - Activity same-project browser race

## Developer review
Test-only extension of dedicated actual PostgreSQL/Chrome harness. Holds cursor
request, retries disabled pointer click, counts one actual HTTP request, then
changes key filter before releasing old page. No application/API/schema changes.
Existing units alone were not actual-browser evidence for this same-project path.

## Product review
Late older-page completion must not append unrelated rows to filtered activity.
Actual event-1 substring filter yields11 rows (event-1 and event-10 through19),
not one exact-key row. After release all row text, no-more-page and loading state
remain unchanged. No exactly-once/delivery or external-service outage claim.

## Designer review
Fresh480x1028 fullpage inspected: key filter and all11 matching rows readable,
header/filter controls fit and no document overflow. Existing layout unchanged.
Screenshot captures completed filter after late old response, not pending state.

## Security review
Only local fixture/own test API reads, no external provider/account changes. Existing
project/filter/destroy fences remain. Scope is exact local browser regression;
no memory erasure/network abort claim. Owner original and todo rechecked.

## QA/integration review
Activity6->8 adds actual held-page repeated-load suppression and stale-page vs
same-project key filter. API265/31/web173/11/reports118/sync644/syncbrowser239/
QAbrowser9 unchanged.45uniqueintegration/config legs completed inner/outer0.
Builds/reaper4/docs4/138routes0; no failures/timeouts/interruption. Native STAGED
116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted.
No app/test edits after native; finalactivity8 rerun0. Bundle570.37kBvs500warning
unchanged. Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/1MISSING/
defaultOFF unchanged; no remote/baseline advance/accepted sync/enabled worker.
