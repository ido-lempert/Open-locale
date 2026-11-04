# 0323 - Late locale failure after repeated glossary visit

## Developer review
Test-only held project metadata503 from visit A, then A->B->A with current columns
settled before release. Asserts old error cannot clear table/columns/draft or publish
error/retry/loading. Exact injected marker proves rejected response really reached
browser. No application/API/schema change; existing unit and old-success proofs stay.

## Product review
Returning to same project id is a new visit: stale failed discovery must not erase
working translation columns or offer misleading retry. Actual failure path complements
previous successful stale bytes test. Bounded200ms observation, not cancellation or
unbounded no-retry claim. Existing unsaved-edit refetch caveat unchanged.

## Designer review
Inspected fresh480x900 actual screenshot: repeated-visit draft/fr+de columns/current
rows retained, no old loading/error/retry, narrow fit. Exact table contents checked
before/after response; no redesign/wide-locale claim.

## Security review
Private-first-visit-locales received by test transport but absent from page; no raw
error or cross-visit state leak. Isolated local metadataGET interception, no provider/
account/scope/spend/license/audience change. Original owner upload recovered and live
main/push access checked before publication.

## QA/integration review
API265/31/web247/13 unchanged uncached0/builds0. Glossarybrowser22->24 final0;47unique
integration/config legs including docs inner/outer0. Tasks80/Tasksbrowser23/Activity22/
QA14/reports118/sync644/syncbrowser239 unchanged. Reaper4/0/docs4/138routes0. Native
STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted.
No app/test edits after native; no failures/timeouts/interruption257. Bundle581.31kB
vs500warning unchanged. Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no remote sync/baselineadvance/accepted sync/worker
enablement. Existing report snapshot/window caveats unchanged.
