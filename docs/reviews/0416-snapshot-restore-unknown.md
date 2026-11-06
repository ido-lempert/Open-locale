# 0416 - Snapshot unknown restore recovery

## Developer review
Unknown restore blocks capture/restore handlers and controls until successful
explicit current read. Restore epoch plus pending-at-read flag prevents reads begun
during restore from clearing later uncertainty. Failed reads retain block. Confirmed
restore with failed follow-up read remains confirmed, not unknown. Project reset and
destroy fences remain; successful recovery clears matching old restore error only.

## Product review
A lost destructive result must not invite blind replay. Fixed guidance asks to check
the project before refreshing and acting again. Current rows/label retained until
explicit read; no automatic replay. Read unlock does not prove outcome, persistent
uncertainty, exactly-once behavior or cancellation.

## Designer review
Inspected actual desktop unknown result: clear check-before-refresh warning above
form, retained label/list, capture/restore disabled, explicit Refresh available.
Text wraps without overlap. Existing snapshot narrow/layout checks pass; no redesign.

## Security review
No raw server error disclosure. Epoch fences read/write recovery; controls and
handlers agree. Optional journal fixture port preserves default55544 after bind
conflicts, no unknown process killed. No API/schema/worker/provider/account/scope/
license/spend changes. Owner upload evidence/live target checked before push.

## QA/integration review
Unit6 unknown replay/capture guard, failed/successful read, read begun during write,
confirmed write/read failure distinction, project/destroy. API265/31 web675/48 builds0.
New actual browser4/0 twice: one restore, no capture/replay/GET, failed explicit read
stays blocked, current successful read unlocks/draft retained. Pixels inspected.
Existing snapshot runner initially27PASS1FAIL timeout on obsolete immediate release,
then41PASS1FAIL missing old warning after successful recovery; explicit reads and
new cleared-warning assertion corrected, final44/0. Journal default55544 bind twice
zero checks/abort (innerRC1 then0 but FAIL rejected by batch); optional55671 final16/0.
Broad API/browser final0 isolated calls. SyncSTAGED95+144239unique/nativeSTAGED116+111+
19246total242unique/four repeated startup checks, every inner/outer0/checkpoints
removed. No host-interrupted verification or canonical uninterrupted claim. Final
sync-config16/native-config14/docs4-138routes/reaper4 all0.22FULL7PARTIAL1MISSING/defaultOFF
and external acceptance unchanged.
