# 0366 - Restore audit failure rollback proof

## Developer review
Test-only real PostgreSQL trigger rejects snapshot.restored audit after restore
writes. Compare complete ordered key/translation/history/restore-audit rows before
and after HTTP500, plus current export. Discriminating mutation preconditions from
295 remain. Trigger/function removed in finally, existing successful restore then
proves recovery. Existing40 assertions retained; now42. No production hook/schema.

## Product review
Failed restore must not leave partially deleted/recreated keys, changed values or
history. Pre-restore safety capture commits separately by design and remains after
failure; explicitly verify exactly one new automatic safety row with mutated keys.
Do not claim entire restore operation rollback or automatic pruning atomicity.

## Designer review
No UI/visual change or new screenshot claim. Existing snapshotbrowser44 verified
against rebuilt API. New evidence is HTTP500, complete persisted rows and export.

## Security review
Fixture injects local database fault only; no production endpoint/provider/account/
scope/spend/license/audience change. Fail-closed suite catches invalid fixture reads.
Original owner upload recovered and live repo/push/main verified before publication.

## QA/integration review
Initial fixture stopped at16PASS0FAIL, inner/outer1: invalid Translation orderBy id
(column is compound key/rowId); history relation also corrected to translation.
Reaper detected live descendants and forced cleanup. Final snapshots42 inner/outer0,
all prior40 retained; no application defect/change. No timeout300.
API265/31 and web304/14 uncached/builds0;49unique bounded integration/config legs
final inner/outer0, incl snapshotbrowser44/docs4/138routes/config16/reaper4.
Syncbrowser95+144=239unique STAGED both0/checkpointremoved, not canonical
uninterrupted. Native116+128=244total242unique STAGED both0/checkpointremoved,
not uninterrupted. Port55554 bind checked. Each browser/native stage isolated.
No app/test edits after stages; only review/PLAN then docs rerun0.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged. No accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kB vs500kB warning unchanged.
