# 0386 - Safe selected comment threads

## Developer review
Generation/key/destroy checks cover read success/error/finally. Closing/reopening,
list reload and destroy invalidate. Read updates matching key count from returned
thread; missing reply target cleared. Post/delete capture generation; continuation
reads only unchanged pane, no list reload. Post clears draft only if text/locale/
reply match submitted values, preserves newer draft. Shared in-flight mutation
signal guards direct duplicate submission too, disabled visible controls. Scope is
pane freshness/draft preservation, not editor-wide route/list/save recovery. No API
or schema change. Requests still run after navigation, no abort guarantee.

## Product review
Failure no longer becomes false empty with raw global error. Fixed read error with
explicit retry; no automatic posts/deletes. Mutation failures use fixed uncertain
result guidance, no definitive rejection/replay promise. Existing mention/thread
semantics preserved. Switching key deliberately resets old comment draft as before;
completed old post cannot clear the new one. Confirmed write clears submitted draft
before read; failed refresh offers retry without re-post. No unsent draft persistence
or receipt/idempotency feature claim. Counts for nonselected threads may lag until
reopened or normal list refresh, not a live feed.

## Designer review
Existing threaded table style preserved. Inline status/alert and retry, disabled
post/delete while mutation pending. Actual desktop failure and recovered thread
pixels inspected: readable guidance/controls and count; still-saving translation
visible in retained textarea. Existing wide-grid mobile/accessibility not audited.
Draft is retained in state while loading, form hidden until read succeeds.

## Security review
Fixed read/write errors do not expose service exception. Literal mention/body
interpolation and server authorization unchanged. Old-key read/mutation cannot
replace selected thread or clear new draft. No external messaging integration or
worker enablement; comment workflow is isolated local project API. No spend,
external registration/license/credential change. User's named-repo upload scope
recovered from original evidence before publication.

## QA/integration review
API265/31 web360/20 uncached/builds0, initial411.59kB below unchanged500budget.
New8 unit checks: old success/error, same-key close/reopen/reload, failure/retry/
count/missing reply, post/delete after selection change, newer draft/duplicate
post, destroy. Browser initial12PASS0; strengthened translation draft claim by
holding actual PUT and verifying persisted Alpha unchanged. Strengthened run had
12PASS1FAIL because duplicate-submit control checked before Angular disabled render;
fixture now waits disabled readiness. Final13PASS inner/outer0. No app fix for test
race. Browser proves held A->B/close/fixed error/actual retry, held original post
finishes after B selected without changing B draft/thread; original A persisted
once in this bounded test (not general exactly-once). Normal post/delete do not
reload genuinely uncommitted translation draft. No timeout/interruption in320.
All55 bounded integration/config legs final0 (54 prior + comments browser), config16/
docs4-138routes/reaper4. Each browser/native stage isolated. Sync STAGED95+144239unique,
native STAGED116+128244total242unique all inner/outer0; not canonical uninterrupted.
Checkpoints removed, no app/test edit after final native. Docker static-only,
coverage22FULL7PARTIAL1MISSING/defaultOFF and external acceptance limits unchanged.
