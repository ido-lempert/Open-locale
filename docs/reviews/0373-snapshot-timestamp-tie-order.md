# 0373 - Deterministic snapshot timestamp tie order

## Developer review
Both list and automatic prune now order createdAt DESC,id DESC. Stable UUID tie
breaker does not imply UUID chronology. Equal timestamp fixture inserts27 valid
known IDs ascending; actual GET must return descending IDs, actual import must
retain highest24 seeded IDs plus new current capture. Prior51 retained, now53.
No persisted schema/response shape change; no app/test edits after staged checks.

## Product review
Defines previously unspecified same-timestamp ordering consistently for list and
retention. CreatedAt remains primary; id only settles ties. Not a changed retention
limit or whole-operation/pruning atomicity guarantee.

## Designer review
No visual/layout change or new screenshot claim. Existing snapshotbrowser44 passed
against rebuilt API. Only ordering among timestamp ties changes, with real GET proof.

## Security review
No production hook/external account/provider/scope/spend/license/audience change.
Local disposable fixtures. Original owner upload recovered, live repo/push/main
checked. Supported merge55574 checked available to avoid303 stale55464 socket.

## QA/integration review
Prefixed API51PASS2FAIL inner/outer1: exactly tie-list order and retained-ID order.
Fixed snapshots53 inner/outer0. API265/31 and web304/14 uncached/builds0.49unique
bounded integration/config legs final inner/outer0, incl snapshotbrowser44/docs4/
138routes/config16/reaper4. No timeout307. Syncbrowser95+144=239unique STAGED both0/
checkpointremoved, not canonical uninterrupted. Native116+128=244total242unique
STAGED both0/checkpointremoved, not uninterrupted. Native55554 bind checked; each
browser/native stage isolated. Only review/PLAN after stages; final docs rerun0.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kB vs500kB warning unchanged.
