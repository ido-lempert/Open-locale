# 0338 - Distinguish filtered empty Tasks

## Developer review
Use selected status or assigned-to-me filter to choose empty text. One unit covers
status/mine/unfiltered. Existing loading/listError suppression retained. No request,
API/schema/data change; no app/test edits after native stages.

## Product review
An empty filtered list is not no tasks. Show No tasks match these filters when status
or mine applies; unfiltered empty retains No tasks yet. Does not change matching,
assignment scope, history or add clear-filter action.

## Designer review
Inspected actual480x900 filtered and unfiltered pixels: correct separate messages,
selected status retained, current new-task draft retained for filtered view, unfiltered
new project blank form, refresh enabled/no error/loading/overflow. No design change
or broad responsive claim.

## Security review
No new source/disclosure/account/provider/scope/spend/license/registration. Isolated
local fixtures only; existing request guards preserved. Original authenticated owner
upload recovered/live repository/push/main validated before publication.

## QA/integration review
API265/31/web275->276/13 uncached0/builds0. Tasksbrowser29->31: actual IN_PROGRESS empty
result on populated project plus unfiltered empty new project. Final47unique integration/
config legs inner/outer0 including docs4/138routes; Tasks80/Glossarybrowser36/Activity28/
QA19/reports118/sync644/syncbrowser239/reaper4. Native STAGED116+128=244total/242unique
PG55534 inner/outer0/checkpointremoved, not uninterrupted. Slow suites isolated; no
suite failures/timeouts/interruption272. Initial todo/start transport45s interrupted;
later progress/read transport60s interrupted. No blind resend; later fresh distinct
status and image reads succeeded, no external mutation during interruptions.
Docker static-only/no daemon claim; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged;
no accepted sync/baselineadvance/worker enablement; report snapshot/window caveats remain.

Bundle583.49->583.63kBvs500warning.
