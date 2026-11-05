# 0368 - Restore webhook signature proof

## Developer review
Existing snapshot check claimed signed webhook delivery but asserted only event and
snapshotId. Real receiver now captures signature header; stronger assertion checks
successful hook creation/restore and exact HMAC-SHA256 over received body with
one-time creation secret. Two new checks reject altered bytes/wrong secret and
compare signed counters/event with successful HTTP result and committed key count.
No application/schema change. Existing43 assertions retained/strengthened, now45.

## Product review
Evidence now matches signed-delivery claim. No new webhook feature, delivery guarantee
or exactly-once claim. Receiver is local and restore payload remains unchanged.
Negative verifier checks ensure altered payloads/wrong secrets cannot pass this test.

## Designer review
No UI/visual change or new screenshot claim. Existing snapshotbrowser44 passed
against rebuilt API. Evidence is actual HTTP receiver bytes, signature and export.

## Security review
Test signing secret remains in memory from authorized local fixture creation,
never printed in new check output or persisted. Uses standard node crypto HMAC,
not custom cryptography. No external account/provider/scope/spend/license/audience.
Original owner upload recovered, live repo/push/main verified before publication.

## QA/integration review
Snapshots43->45 inner/outer0. No failure/timeout302. API265/31 and web304/14 uncached,
builds0;49unique bounded integration/config final legs inner/outer0, incl
snapshotbrowser44/docs4/138routes/config16/reaper4. Syncbrowser95+144=239unique STAGED
both0/checkpointremoved, not canonical uninterrupted. Native116+128=244total242unique
STAGED both0/checkpointremoved, not uninterrupted. Port55554 bind checked; each
browser/native stage isolated. No app/test edits after stages; only review/PLAN
then final docs rerun0.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kB vs500kB warning unchanged.
