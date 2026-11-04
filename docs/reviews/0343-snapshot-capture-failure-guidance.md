# 0343 - Snapshot capture failure guidance

## Developer review
Clear notice at capture start; fixed catch text instead of raw exception. Retain
existing label/list and release creating. One unit covers pending notice clearing,
failed label/list retention, no refetch/private error. No API/schema change. No app/
test semantic edits after native stages; final trailing whitespace removed.

## Product review
A failed capture has uncertain outcome: check snapshots before retrying. Do not
claim rollback or automatically recapture. Existing displayed snapshots remain
historical list, not proof the failed attempt did nothing. Clear old success notice
on next attempt. Restore errors/route reuse/late mutation destruction remain work.

## Designer review
Inspected actual480x900 failure pixels: fixed error wraps readably, newer label and
current rows/counts/restore controls retained, capture reenabled, old success absent.
No layout change/broad responsive/accessibility/restore-interaction claim.

## Security review
Capture errors no longer display server exception text; actual503 marker verified
not rendered. Local fixtures only. Restore errors unchanged and not claimed hardened.
No new source/disclosure/account/provider/scope/spend/license/registration. Original
authenticated owner upload recovered; live repository/push/admin/main validated.

## QA/integration review
API265/31/web282->283/14 uncached0/builds0. Snapshotbrowser7->9: held new capture clears
old success while preserving list/draft; actual failedPOST shows fixed uncertain
outcome text/no raw details/old notice, retains rows/label, reenabled control. Initial
8PASS/1FAIL pending assertion raced Angular DOM settling after held request flag.
Post-failure check passed. Added explicit disabled/no-notice DOM wait; final9/inner/
outer0, no app fix. No timeout/interruption277.

49unique integration/config legs bounded inner/outer0 including docs4/138routes and
stage-config16. QA21/Activity28/Tasks31/Glossary38/Snapshot9; sync644/automation132/
2FA37/reports118/reaper4 all0. Syncbrowser STAGED95+144=239unique both0/checkpointremoved,
not canonical uninterrupted. Native STAGED116+128=244total/242unique PG55534 both0/
checkpointremoved, not uninterrupted. Every browser/native stage isolated.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
sync/baselineadvance/worker enablement; report snapshot/window caveats remain.
Bundle584.66->584.71kBvs500warning.
