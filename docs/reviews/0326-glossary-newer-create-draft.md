# 0326 - Keep newer glossary creation draft

## Developer review
Capture raw term/notes/checkbox snapshot before POST, derive trimmed request from
that snapshot, and clear only if whole current draft still equals it. Inputs stay
editable while submit remains pending/disabled. Existing visit/destroy guards and
server list refresh remain. Three independent term/notes/checkbox change units
prove whole-draft retention, original snapshot payload and pending cleanup.
No API/schema change. No app/test edits after final native stages.

## Product review
Previously successful same-visit POST erased newer input typed while pending. Now
submitted term persists once and newer whole draft remains for later submission.
Unchanged draft still clears normally. Not server idempotency/cancellation or a
cross-client concurrency guarantee. Other mutation refetch can replace unsaved row
translation edits; this slice addresses new-term form only.

## Designer review
Inspected actual fresh480x900 screenshot after held POST/edit/release: newer term,
notes and checked do-not-translate retained; submitted row/context visible, submit
released, no error/pending/overflow. Existing narrow translation fields scroll long
text. No layout redesign or wide-locale fit claim.

## Security review
Snapshot adds no new disclosure/source/permission. Visit/destroy fences remain.
No external registration/provider/scope/spend/license change; isolated local test
fixtures only. Owner upload original recovered before publication; live repository,
push permission and main checked. Draft retention is local, not an authorization
or server concurrency control.

## QA/integration review
API265/31/web251->254/13 uncached0/builds0. Actual held POST allows newer form edits;
release persists only submitted snapshot, retains newer term/notes/checkbox and
releases submit: glossarybrowser27->29. Final47unique integration/config legs
including docs inner/outer0. Tasks80/Tasksbrowser23/Activity22/QA14/reports118/sync644/
syncbrowser239 unchanged. Reaper4/0/docs4/138routes0. Native STAGED116+128=244total/
242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted.

Chronology: combined API+A+B hit120s after API/A green and B through review; killed
migration left dead3701/stale socket55459. Full B rerun migration0checks/rc1, others
green. Verified dead PID/no TCP listener, removed stale socket, isolated migration22/
inner0/outer0. Combined migration+automation+2FA then hit120s during2FA after migration22/
automation132 inner0; retry2FA0checks/rc1 found stale socket55474/dead6309. Verified
dead PID/no TCP listener, removed stale socket; isolated standard2FA37/inner0/outer0.
To obtain clean outer status for originally combined legs, reran A clean; combined
A+automation hit120s during automation after A inner0. Immediate automation retry
0checks/rc1 found stale socket55470/dead12447 (attempted environment override was
not supported by this script; standard port remained in use). Verified dead PID/no
TCP listener, removed stale socket; isolated standard automation132/inner0/outer0.
No failed application assertions; original incomplete attempts are not passes.

Bundle581.78->581.93kBvs500warning. Docker static only/no daemon claim. Coverage22FULL/
7PARTIAL/1MISSING/defaultOFF unchanged; no accepted remote sync/baselineadvance/
worker enablement. Existing report snapshot/window caveats unchanged.
