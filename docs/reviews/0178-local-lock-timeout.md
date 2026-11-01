# 0178 - Bounded local apply lock wait

## Developer pass
SET LOCAL lock_timeout='2s' executes inside the same Serializable apply transaction
before scope locks. Transaction-local setting cannot leak into pooled later work.
Known PrismaP2010/meta.code55P03 maps safe busy409. No retry,message text matching or
catch-all transaction conversion. Existing40001/P2034 handling unchanged. Bound is
per lock wait,not total request/cumulative waits;Prisma transaction deadline still
exists and other unexpected failures remain500.

## Product pass
Busy database yields compare/review-again conflict rather than hanging until an
opaque timeout. Released locks permit later explicit reviewed request,not automatic
retry. No remote writes/baseline advance/accepted sync/external acceptance. Worker
defaultOFF. Existing-key local set/removal unchanged.22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI layout change. Actual updated480x900 confirmation pixels inspected:wrapped
scope/digest,effect notice and separated apply/cancel readable,no overflow. Existing
browser108 covers actual apply/cancel/stale review/navigation. README/OpenAPI state
per-lock bound accurately rather than promising2second whole-request response.

## Security pass
Lock timeout set by constant SQL,not client input. Known class/wrapper/SQLSTATE
55P03 only maps409,no private database error text exposed. Atomic rollback retained.
No new credential/scope/spend/registration/license/audience. Waiting does not waive
reviewed scope or current membership checks.

## QA/integration pass
Sync300->304: actual HTTP while separate real PG transaction holds project row;
409 exact safe message after2018-2019ms,no retry. Value/history/TM/activity/intents
unchanged. Separate real transaction holds translation row;actual HTTP same bounded
409;state rollback. Blockers released in finally. Later actual HTTP set/removal
success cases prove service recovers after release. Initial302clean,expanded304clean,
full sweep304clean. No failures/interruption112. No synthetic lock error.
API248/30,web52/7,both builds,reaper4RC0.43integration/config legs14completed
fail-closed batches,all individual/outerRC0;48inventory. Webhook45,migration10,
automation116,sync304/browser108. Native staged116+128=244total/242unique,all242literal
source labels covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted.
No live fixture services/temp bundles.
