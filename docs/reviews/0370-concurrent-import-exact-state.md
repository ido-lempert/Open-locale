# 0370 - Exact concurrent import and capture predicates

## Developer review
Existing concurrent-import test ignored response statuses and values, accepted any
first safety count >=baseline. Require all201, exact complete final export matching
all baseline bytes plus three expected values, and exact base/base+1/base+2 counts.
Negative fixtures reject wrong/missing/extra state, shifted start and short series.
Prior46 assertions retained/strengthened, now48. Test-only/no application change.

## Product review
Key presence is not successful value import; arbitrary growing counts are not exact
pre-import states. Strengthened predicates match the existing claim for this real
three-request fixture, not a general concurrency/ordinary-edit serialization claim.

## Designer review
No UI/visual change or new screenshot claim. Existing snapshotbrowser44 passed
against rebuilt API. New evidence is real request statuses/exports/safety counts.

## Security review
No production hook/account/provider/scope/spend/license/new audience. Local disposable
fixtures. Original owner upload recovered and live repository/push/main verified.
Existing supported merge PG override55574 checked available before use to avoid303
stale55464 socket. Unknown listener/socket not killed or removed.

## QA/integration review
Snapshots46->48 inner/outer0, no failure/timeout304. API265/31 and web304/14 uncached,
builds0.49unique bounded integration/config legs final inner/outer0, including
snapshotbrowser44/docs4/138routes/config16/reaper4. Separate a/b batches avoid303
combined timeout. Merge alternate55574 passes7. Syncbrowser95+144=239unique STAGED
both0/checkpointremoved, not canonical uninterrupted. Native116+128=244total242unique
STAGED both0/checkpointremoved, not uninterrupted. Native55554 bind checked; each
browser/native stage isolated. No app/test edit after stages; review/PLAN only,
then final docs rerun0.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged. No accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kB vs500kB warning unchanged.
