# 0367 - Restore safety capture failure proof

## Developer review
Test-only PostgreSQL trigger rejects automatic before-restore snapshot INSERT.
Actual HTTP500 must leave complete ordered snapshot/key/translation/history/
restore-audit row arrays and current export unchanged. Trigger/function removed in
finally. Existing later audit-failure/success checks prove continuation after cleanup.
Prior42 assertions retained, now43. No application or schema change.

## Product review
A safety snapshot failure must abort restore before destructive writes. Distinct
from300 audit-failure boundary, where safety snapshot has already committed. No
claim of rollback for separately committed pruning or whole-operation atomicity.
No retry feature or broader serialization guarantee.

## Designer review
No UI/visual change or new screenshot claim. Existing snapshotbrowser44 passed
against rebuilt API. Evidence is HTTP500 and complete persisted row comparisons.

## Security review
Fault injection confined to disposable local PostgreSQL; no production test hook,
external account/provider/scope/spend/license/new audience. Owner original upload
recovered and live repository/push/main checked before publication.

## QA/integration review
Snapshots42->43 inner/outer0; no failure/timeout301. API265/31 and web304/14 uncached,
builds0;49unique bounded integration/config legs final inner/outer0, incl
snapshotbrowser44/docs4/138routes/config16/reaper4. Syncbrowser95+144=239unique STAGED,
both0/checkpointremoved, not canonical uninterrupted. Native116+128=244total242unique
STAGED both0/checkpointremoved, not uninterrupted. Port55554 bind checked; each
browser/native stage isolated. No app/test edits after stages. Only review/PLAN
added afterward; docs rerun0.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged. No accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kB vs500kB warning unchanged.
