# 0369 - Exact serial-state snapshot race predicate

## Developer review
Existing race postcondition accepted race.key expected or absent, even when baseline
keys were missing/wrong or unrelated keys remained. Replace with exact full English
and Hebrew maps matching either serial order. Additional negative check rejects
unrelated English key, missing baseline key, wrong English value and wrong Hebrew
value. Existing45 assertions retained/strengthened; now46. No application change.

## Product review
Concurrent import/restore correctness requires one whole valid serial outcome,
not only the racing key. This proves observed final exports of this real two-request
fixture; no general concurrency, serializable capture or ordinary-edit lock claim.

## Designer review
No UI/visual change or new screenshot claim. Existing snapshotbrowser44 passed
against rebuilt API. New evidence is actual concurrent HTTP requests and exports.

## Security review
No production hook, external account/provider/scope/spend/license/audience change.
Local disposable database. Original owner upload recovered, live repo/push/main
verified before publication. Unknown listeners were not killed or overwritten.

## QA/integration review
Snapshots45->46 inner/outer0, no assertion failure. API265/31 and web304/14 uncached,
builds0. Combined a+b verification call exceeded120s: a13legs completed0/BATCH_FAIL0,
b completed through branches0, but call outer result interrupted, not reported0.
Merge startup interrupted; defunct descendants remained with stale Unix socket
PG55464 lock attributed to defunct PID3876. Remaining-only merge attempt0checks1,
then immediate retry0checks1 before diagnosis. Checked supported alternate55574
available; override ran7checks inner/outer0. Plural65/config10 and remaining final
legs0. Completed checks preserved, no unchanged full timeout retry. Final49unique
bounded integration/config legs have per-leg0; interrupted batch outer is explicitly
not a clean0. Other final calls outer0. No application change; stale original
socket not removed, defunct PID not killed. Final reaper4 passes.

Syncbrowser95+144=239unique STAGED both0/checkpointremoved, not canonical
uninterrupted. Native116+128=244total242unique STAGED both0/checkpointremoved,
not uninterrupted. Port55554 bind checked; each browser/native stage isolated.
Snapshotbrowser44/docs4/138routes/sync-stage-config16 all0. No app/test edit after
stages; review/PLAN then docs rerun0.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kB vs500kB warning unchanged.
