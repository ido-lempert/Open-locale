# 0330 - Guard explicit glossary refresh during mutation

## Developer review
Share creating/saving/deleting pending state with refresh disabled binding and method
guard. Prevent explicit refresh read while a mutation is pending, so manual refresh
cannot replace row/comparison with pre-write values. Three units independently prove
create/save/delete suppression and read eligibility after settlement. No API/schema
change; existing route/destroy/list sequence fences remain.

## Product review
A manual refresh during held write could display older server state and interfere
with local saved comparison. Suppress that explicit action until mutation settles.
Not all mutation-refetch serialization, server concurrency, cancellation, idempotency
or unsaved-row preservation. Other concurrent mutation-triggered reads remain a
separate concern. Failed saves retain uncertain-outcome guidance/edited text.

## Designer review
Inspected actual480x900 pending-save pixels: refresh visibly disabled, saving status
visible in row, row controls disabled, new-term draft retained, hint remains readable.
Narrow long input scrolls normally. No layout redesign or broad responsive claim.
After successful save browser checks refresh enabled again.

## Security review
Pending guard is local lifecycle protection, not authorization or cross-client control.
No disclosure/source/account/provider/scope/spend/license/external registration change.
Isolated local fixtures only. Existing visit/destroy guards retained; owner upload
original recovered/live repository/push/main validated before publication.

## QA/integration review
API265/31/web264->267/13 uncached0/builds0. Actual held POST/DELETE/PATCH each tests
pointer refresh disabled/no GET/no list loading during150ms observation; save release
also restores refresh control. Glossarybrowser33->36; no assertion removed/weakened.
Final47unique integration/config legs inner/outer0 including docs4/138routes. Tasks80/
Tasksbrowser26/Activity22/QA14/reports118/sync644/syncbrowser239/reaper4 unchanged.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not
uninterrupted. No app/test edits after native; slow suites isolated. No failures/
timeouts/interruption264. Docker static-only/no daemon claim; coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no accepted sync/baselineadvance/worker enablement.
Existing report snapshot/window caveats unchanged. Bundle582.93->583.08kBvs500warning.
