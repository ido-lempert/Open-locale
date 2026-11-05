# 0344 - Snapshot capture destruction fence

## Developer review
Guard capture entry, success/catch/finally after destruction. Existing list destroy
fence retained. Three units cover late success/failure and fresh destroyed submit;
no local mutation/read after destroy. Pending flag stays on discarded instance,
not a live screen. No API/schema change or app/test edits after native stages.

## Product review
Leaving capture screen does not cancel server capture. Actual submitted snapshot
still persists; prevent discarded UI success/error/draftclear and list refetch.
Same-component project reuse and restore completion remain separate code work.

## Designer review
Inspected actual480x1711 editor pixels after leaving pending capture and releasing
success: editor header/actions/translation rows remain, no snapshot list or stale
capture notice. No UI/layout change or broader responsive claim.

## Security review
Discarded capture failure cannot publish raw/fixed error after destroy. Local
fixtures only. No new source/disclosure/account/provider/scope/spend/license/
registration. Original authenticated owner upload recovered; live repository/push/
admin/main validated. Not a request cancellation or remote rollback claim.

## QA/integration review
API265/31/web283->286/14 uncached0/builds0. Snapshotbrowser9->11 real heldPOST followed
by actual Back navigation into editor, then release success: persisted server label,
zero browser snapshot list GETs after leave, editor route/no stale notice/list/runtime
error. Unit failure path complements actual success path; no browser late-failure
claim. No suite failures/timeouts/interruption278. Each browser/native stage isolated.

49unique bounded integration/config legs inner/outer0 including docs4/138routes and
stage-config16. Snapshot11/QA21/Activity28/Tasks31/Glossary38; sync644/automation132/
2FA37/reports118/reaper4 all0. Syncbrowser STAGED95+144=239unique both0/checkpointremoved,
not canonical uninterrupted. Native STAGED116+128=244total/242unique PG55534 both0/
checkpointremoved, not uninterrupted. Native second call118.5s completed, no timeout.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
sync/baselineadvance/worker enablement; report snapshot/window caveats remain.
Bundle584.71->584.79kBvs500warning.
