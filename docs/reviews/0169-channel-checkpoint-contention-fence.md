# 0169 - Channel checkpoint lock-before-clock fencing

## Developer pass
Both channel handlers use shared checkpoint helper. Explicit intent row lock
precedes token/deadline evaluation. Literal SQL statements for allowed channel
union avoid dynamic identifiers;invalid runtime channel rejected. Existing timestamp
cannot be overwritten. Short bookkeeping transaction,no effects/network inside.
Stale comment about absent rule ledger corrected;crash gap remains.

## Product pass
Independent webhook/automation semantics unchanged. Blocked stale worker cannot
record channel success after token reclaim/deadline expiry. Effect-before-checkpoint
crash gap and partial effects remain;not exactly-once/rollback. No production timer/
public apply/baseline advance/remote write/external acceptance;22FULL/7PARTIAL/
1MISSING unchanged.

## Designer pass
No UI. Current native1280x800 editor screenshot inspected: locale columns,saved
state/memory suggestion readable without overlap. Existing UI evidence,not a new
feature. README/plan describe contention boundary without completion claims.

## Security pass
Four actual PG contention cases (channel x token/deadline) observe separate waiter
in pg_stat_activity Lock state before blocker changes context. All deny checkpoint
and leave both timestamps null. Existing live-token/deadline checks run after lock
wait. No registration/credential scope/spend/license/audience change.

## QA/integration pass
Automation95->101: four real-lock stale channel denials;live channels independently
write;existing timestamp cannot overwrite. Actual helper/PG transactions,not mocked
DB/timing-only claims. Standalone webhook45,combined/partial retry/task/offline MT/
real-socket cases retained. No failing test or host interruption103.
API248/30,web48/7,both builds,reaper4RC0.43integration/config legs14clean fail-closed
batches,all individual/outerRC0;48inventory. Webhook45,migration10,sync268/browser98.
Native116+128=244total/242unique,all242literal source labels covered,inner/outerRC0,
checkpoint removed. Staged,not uninterrupted. No active fixture services/temp bundles.
