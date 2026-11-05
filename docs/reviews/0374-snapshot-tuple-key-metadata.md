# 0374 - Tuple-scoped key metadata recovery

## Developer review
Test-only extension of existing valid colliding tuples. Capture first tuple with
named description/maxLength17/first-tag, second with defaults. Mutate both keys via
real PATCH APIs. Restore must recover first metadata and second empty description/
tags/null maxLength. Review strengthened fixture precondition to assert every changed
field on both persisted rows, not only status/partial fields. Prior53 retained, now55.

## Product review
Translation recovery does not prove key metadata recovery. Assert both independently,
including explicit null/empty fields. Does not claim all metadata/plural coverage or
new restore capability; exercises existing behavior across branch/key boundaries.

## Designer review
No UI/visual change or new screenshot claim. Existing snapshotbrowser44 passed
against rebuilt API. New evidence is real PATCH/restore requests and persisted rows.

## Security review
No production hook/external account/provider/scope/spend/license/audience change.
Local disposable fixtures. Original owner upload recovered and live repo/push/main
checked. Supported merge55574 checked available to avoid303 stale55464 socket.

## QA/integration review
Snapshots53->55 initial0, strengthened final55 inner/outer0. No failure/timeout308.
API265/31 and web304/14 uncached/builds0.49unique bounded integration/config legs
final inner/outer0, incl snapshotbrowser44/docs4/138routes/config16/reaper4.
Syncbrowser95+144=239unique STAGED both0/checkpointremoved, not canonical
uninterrupted. Native116+128=244total242unique STAGED both0/checkpointremoved,
not uninterrupted. Native55554 bind checked; each browser/native stage isolated.
No app/test edit after stages; review/PLAN only, then final docs rerun0.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kB vs500kB warning unchanged.
