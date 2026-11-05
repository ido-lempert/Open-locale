# 0375 - Restore receiver failure does not roll back data

## Developer review
Local receiver switches200->503 only after preceding successful restore journal
settles. Import adds verified extra key; real restore removes it and returns201.
Wait for failed delivery journal: status503, attempts2, successfalse, exactly two
receiver hits with valid signatures/snapshotId. Finally restores receiver200.
Review added explicit preceding journal success/attempt/status assertion. Prior55
retained, initial57pass then final58pass; no application/schema change.

## Product review
Receiver failure is independent of already committed recovery. Prove observed
committed values and bounded attempted delivery, not guaranteed delivery/exactly-once
or absence of all future retries beyond this completed two-attempt implementation.

## Designer review
No UI/visual change or new screenshot claim. Existing snapshotbrowser44 passed
against rebuilt API. Evidence is real receiver503/journal/HTTP201/export.

## Security review
Fixture is local disposable database/receiver; no production hook/external account/
provider/scope/spend/license/audience change. Signing secret not printed by new
assertions. Original owner upload recovered and live repo/push/main checked.
Merge55574 checked available to avoid303 stale55464 socket.

## QA/integration review
Snapshots55->58 final inner/outer0, no failure/timeout309. API265/31 and web304/14
uncached/builds0.49unique bounded integration/config final legs inner/outer0, incl
snapshotbrowser44/docs4/138routes/config16/reaper4. Syncbrowser95+144=239unique STAGED
both0/checkpointremoved, not canonical uninterrupted. Native116+128=244total242unique
STAGED both0/checkpointremoved, not uninterrupted. Native55554 bind checked; each
browser/native stage isolated. No app/test edit after stages; review/PLAN only,
then final docs rerun0.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kB vs500kB warning unchanged.
