# 0327 - Keep newer task creation draft

## Developer review
Capture raw title/description/date/assignee/dependency/selected-key array copy/lock
snapshot before POST. Request uses snapshot; clear whole form only if every field
still matches. Compare key array by length/order/value, not reference. Eight units
cover each independent field change and mutable array isolation. Existing unchanged
draft clear, visit/destroy guard and pending duplicate suppression remain.
No API/schema change. No app/test edits after native stages.

## Product review
Successful same-visit task POST previously erased later form edits. It now persists
only submitted snapshot while preserving entire newer draft for later submission.
Not server idempotency/cancellation/cross-client concurrency control; metadata/list
replacement and option availability are separate from preserving signal values.

## Designer review
Inspected fresh actual480x1025 full-page pixels: newer title/context/date, unassigned/
no predecessor/unselected key/unlocked form remain, submit released; submitted row
has original context/date/Owner/dependency/key lock. No error/pending; narrow layout
wraps normally. No broad responsive redesign or wide-content claim.

## Security review
Local immutable snapshot adds no new disclosure/source. Existing project-generation/
destroy checks remain. No registration/provider/scope/spend/license change; isolated
fixtures only. Original owner upload message recovered; live main/push verified
before publication. Form draft is not an authority or server concurrency mechanism.

## QA/integration review
API265/31/web254->262/13 uncached0/builds0. Actual held POST/edit/release checks persisted
original title/context/date/assignee/dependency/key/lock plus every newer form field;
tasksbrowser23->26. Final47unique integration/config legs inner/outer0 including
Docs4/138routes; Tasks80/Glossarybrowser29/Activity22/QA14/reports118/sync644/syncbrowser239.
Reaper4/0. Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved,
not uninterrupted. Automation132 and2FA37 isolated inner/outer0.

Chronology: first two task-browser runs25pass/1fail (persisted lock/key assertion).
Attempted checked-field readiness run23pass/timeout; diagnostic run24pass/2fail found
Angular multiple-select DOM option values encoded rather than raw IDs. Corrected
fixture to choose actual option value; final26/inner0/outer0. Trailing diagnostic
grep(no FAIL) shell1 only. No app changes or assertion weakening from fixture failure.
Isolated syncbrowser120s interrupted at186checks, left nx8727/Chrome8784/deadPG8665.
Other browser checks completed14/22/29 before cleanup. Killed leftover Nx/Chrome;
first sync retry0checks/FAIL stale55479 socket (script rc0 but wrapper rc1). Verified
dead PID/no TCP listener, removed stale socket; clean isolated239/inner0/outer0.
Incomplete attempts are not passes; no other regression interruptions.

Docker static-only/no daemon claim; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
No accepted sync/baselineadvance/worker enablement. Existing report snapshot/window
caveats unchanged. Bundle581.93->582.35kBvs500warning.
