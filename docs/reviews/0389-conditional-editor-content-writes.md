# 0389 - Conditional editor content writes

## Developer review
Loaded CellState captures version/rowId; absent cell version0. API client adds
optional conditional fields without changing backend protocol. Existing row missing
identity/version fails closed, never unconditional fallback. Confirmed response
advances baseline; next write uses returned identity/version. Returned status
response advances only if value/forms match saved baseline. No status CAS claim;
concurrent status/value ordering can cause conservative conflict rather than lost
content. Normal in-flight same-cell newer draft handling retained. Existing native
plain/plural/review/TM legs pass. No editor-wide route/list/save reconciliation.

## Product review
Stale editor must not silently overwrite newer content. Conflict/unknown/missing
identity leaves local draft and fixed warning, blocks blur/force resubmit. Explicit
review-retained-values action exposes existing copy+reload UI before replacement.
No force overwrite option. Any failed response may conceal committed write; no
claim it definitely failed or repeating is safe. Task-lock denial now uses same
fixed conservative guidance instead of raw backend reason; import preview still
names a real lock and Tasks remains available. User must explicitly reload after
lock is fixed, not blind retry. Read/reload copies are local values, not backups.

## Designer review
Fixed inline save guidance/action, existing outside-grid retained-value copy UI.
Actual800x600 copy-conflict/reloaded screenshots inspected; readable warning and
copy textarea. Conflict screenshot lower grid partly below viewport, scrollable;
no full-page/mobile accessibility claim. No new modal/automatic reload. Existing
wide-grid appearance otherwise preserved.

## Security review
Conditional version AND immutable identity close same-version delete/recreate
content overwrite through this editor; existing server enforces authorization.
Missing metadata fails closed. Fixed write guidance never echoes raw service errors.
No retry after unknown response, no automatic overwrite/credential/provider/API
change. Status mutation concurrency remains explicitly outside guarantee. Private
local DB/browser fixture only, no external registration/worker/spend/license change.
Original named-repository upload source recovered before publication.

## QA/integration review
API265/31 web378/23 uncached/builds0, initial416.19kB below500budget. Unit5 cover
loaded/confirmed next baseline, absent0, failed/unknown draft/no force replay/reload,
missing identity failclosed and matching status baseline. Versionbrowser11 final0
proves actual two-editor conflict/nonoverwrite/no replay/copy/reload, recreated row
same version different identity rejected, fresh identity normal save, absent0.
Fixture chronology: first two attempts0PASS2FAIL background-page synthetic input/
blur never submitted; foreground actual click/key input fixes. Next7PASS1abort
missing rendered retry button, readiness wait fixes. Final11 then final-app rerun11
both inner/outer0, no app fix for fixture issues. Final app form-match correction
covered final units/builds and later suites.
Native initial first116PASS0, second125PASS3FAIL outer1: obsolete lock-flow expected
old raw reason/save-failed text and blind retry after DONE. Updated to fixed safe
warning/copy/reload flow. Native source-hash change required new first116+second128,
final inner/outer0. Prior evidence retained in logs, checkpoints removed. Final244
checks242unique explicitly STAGED, not canonical uninterrupted. SyncSTAGED95+144239
unique inner/outer0. All58 bounded integration/config legs final0 (57prior+version
browser), config16/docs4-138routes/reaper4. Browsers/native stages isolated. No app/
test edit after final native. No323 timeout/interruption; unsuccessful suites above
completed with failures. Docker static-only/coverage22FULL7PARTIAL1MISSING/defaultOFF/
external acceptance unchanged.
