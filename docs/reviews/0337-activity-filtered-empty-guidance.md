# 0337 - Distinguish filtered empty Activity

## Developer review
Use action/actor/nonblank trimmed key filter state to choose empty guidance. No request,
API/schema or history mutation change. One unit covers each filter and whitespace-only
key. Existing loading/error suppress empty-success. No app/test edits after native.

## Product review
An empty filtered result is not no history. Show No activity matches these filters
when a filter applies; unfiltered empty retains No activity yet. Does not claim complete
history/window scope, change filter matching or add clear-filter action.

## Designer review
Inspected fresh actual480x900 filtered and unfiltered pixels: correct separate text,
filters retained/reset as appropriate, refresh enabled, no error/loading/overflow.
No layout redesign or broader responsive claim.

## Security review
No new source/disclosure/account/provider/scope/spend/license or registration. Local
fixtures only; existing request guards unchanged. Original authenticated owner upload
evidence present in task context; attempted fresh recovery timed out. Live repository/
push/main checked before publication.

## QA/integration review
API265/31/web274->275/13 uncached0/builds0. Activitybrowser26->28 checks actual filtered
empty state and truly empty project (local fixture event cleanup only). Final47unique
integration/config legs inner/outer0 including docs4/138routes; Tasks80/Tasksbrowser29/
Glossarybrowser36/QA19/reports118/sync644/syncbrowser239/reaper4. Native STAGED116+128=
244total/242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted. Slow suites
isolated; no suite failures/timeouts/interruption271. Publication setup tools call45s
interrupted after credential file created; subsequent observation read daemon timeout.
No remote publication attempted during interruption. Original owner evidence remains
available in conversation context. Docker static-only/no daemon claim; coverage22FULL/
7PARTIAL/1MISSING/defaultOFF unchanged; no accepted sync/baselineadvance/worker enablement.
Existing report snapshot/window caveats unchanged; bundle583.32->583.49kBvs500warning.
