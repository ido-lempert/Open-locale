# 0341 - Snapshot list recovery

## Developer review
Separate listError from mutation error. Clear rows at read start; hide list during
pending/failure; latest-read generation and destroy fence prevent old list completion.
Three units cover stale/pending/failure/retry/draft+mutation-error retention, older
failure and destroy. No API/schema change. No app/test edits after native stages.

## Product review
List unavailable is not No snapshots yet. Fixed read error/retry lets people recover
without recapturing a snapshot. Successful capture notice remains truthful when its
subsequent read fails. Does not change restore effects/confirmation, mutation error
handling, label retention during create, or route reuse; those remain code work.

## Designer review
Inspected actual480x900 failure/loading/recovered pixels. Failure has readable fixed
error/retry and no restore rows. Loading has status and no list/retry/empty. Recovery
shows persisted captures/counts/restore controls and retained new label. No broader
responsive/accessibility claim or restore interaction proof in this slice.

## Security review
List errors no longer display server exception text. Actual503 marker stays private;
local fixtures only. Mutation errors retain existing behavior and are not claimed
hardened. No new source/disclosure/account/provider/scope/spend/license/registration.
Original authenticated owner upload recovered; live repository/push/admin/main validated.

## QA/integration review
API265/31/web277->280/14 uncached0/builds0. New snapshotbrowser5 actual persisted list,
post-capture failed read hiding stale restore/empty/raw error, held retry suppression
of rows/empty/retry with label retained, successful actual recovery and runtime/
overflow checks. First invocation suite/batch/reaper0 but shell1 from trailing grep
with no FAIL matches; added failure screenshot and reran final suite/outer0. No failed
assertions/timeouts/interruption275. Each browser/native stage isolated.

All48unique integration/config legs inner/outer0 including docs4/138routes. Snapshots28/
newbrowser5; QA21/Activity28/Tasks31/Glossary38; sync644/syncbrowser239/automation132/
2FA37/reports118/reaper4 all0. Native STAGED116+128=244total/242unique PG55534 both0/
checkpointremoved, not uninterrupted. Docker static-only; coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no accepted sync/baselineadvance/worker enablement;
report snapshot/window caveats remain. Bundle583.77->584.62kBvs500warning.
