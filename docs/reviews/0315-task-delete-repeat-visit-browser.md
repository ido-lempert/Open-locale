# 0315 - Repeated-visit task deletion failure in Chrome

## Developer review
Test-only extension holds actual DELETE for visit A, routes A->B->A, then releases
failed503. Asserts exact marker received, one request, no repeated-visit GET/error/
pending overwrite, same row text and draft/enabled control. Existing unit coverage
already fences this path; browser proof establishes real reused route boundary.
No application/API/schema edits.

## Product review
Same project id is not enough: returning to it is a new visit, and an old failure
must not overwrite its clean state or draft. Real persisted task stays intact for
this intercepted rejected request. No cancellation, general server failure atomicity,
unbounded no-retry or idempotency claim. Observation after release bounded200ms.

## Designer review
Inspected fresh480x900 actual final screenshot: Repeated visit draft retained,
current DONE row/control enabled, no old error or pending indicator, controls fit.
No layout change or mockup. Prior current-failure guidance remains separately tested.

## Security review
Injected private-old-visit-delete received by test transport but absent from page.
Interception restricted to local fixture DELETE/current original project; isolated
Chrome/API/PG, no external provider/account/spend/license/scope change. Original
owner upload message recovered before publishing; live remote/main checked.

## QA/integration review
API265/31/web223/12 unchanged uncached0/builds0. Tasksbrowser21->23 final0; Tasks80/
Activity22/QA14/reports118/sync644/syncbrowser239 unchanged.46unique integration/config
legs including docs inner/outer0; reaper4/0/docs4/138routes0. Native STAGED116+128=
244total/242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted. No app/
test edits after native, no failures/timeouts/interruption249. Bundle577.34kBvs500
warning unchanged. Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no remote sync/accepted sync/baselineadvance/enabled
worker. Existing report snapshot/window caveats unchanged.
