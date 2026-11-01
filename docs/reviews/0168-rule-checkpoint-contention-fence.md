# 0168 - Rule checkpoint fencing under contention

## Developer pass
Extract rule checkpoint helper, lock intent before evaluating state/token/database
clock and insert. A writer waiting behind reclaim/expiry reads committed new
context, not pre-wait eligibility. Existing adapter uses helper in short transaction.
No effects/network inside checkpoint transaction;unique intent/rule conflict still
returns false. Current scope validation stays in effect guard,not a checkpoint grant.

## Product pass
A completed effect cannot obtain stale success bookkeeping after another worker
reclaims its lease or deadline expires during wait. Effect-to-checkpoint crash gap
remains;not exactly-once/rollback. No production timer/public execution/baseline
advance/remote write/external acceptance;22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI. Current native1280x800 editor screenshot inspected: locale columns,saved
state/memory suggestion readable without overlap. Existing UI evidence,not new
feature. README/plan describe lock-before-clock and remaining crash gap.

## Security pass
Actual PG row lock serializes checkpoint with token change. Separate waiter is
observed in pg_stat_activity wait_event_type=Lock before blocker changes token or
expires deadline. Both deny insertion after release. No credential/scope/spend/
license/registration/audience change. Post-effect and other post-check races remain.

## QA/integration pass
Automation89->95: for token/deadline each observes actual lock wait then zero ledger
insertion;live writer stores exact revision7;project deletion cascades intent ledger.
Actual PG transactions/helper,not timing-only/double claims. Existing partial retry,
expired-effect,task,offline MT and real-socket cases retained. No failure/interruption102.
API248/30,web48/7,both builds,reaper4RC0.43integration/config legs14clean fail-closed
batches,all individual/outerRC0;48inventory. Webhook45,migration10,sync268/browser98.
Native116+128=244total/242unique,all242literal source labels covered,inner/outerRC0,
checkpoint removed. Staged,not uninterrupted. No active fixture services/temp bundles.
