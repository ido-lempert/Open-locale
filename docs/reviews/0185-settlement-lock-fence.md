# 0185 - Explicit settlement lock-before-clock fence

## Developer pass
Settlement sets transaction-local2sec lock timeout then locks intent before UPDATE
checks current token/state/DB deadline. Prevents pre-wait clock eligibility from
becoming post-expiry permission. Existing completed/retry/backoff/attempt fields
unchanged. Per-lock wait only,not cumulative runner/claim/network duration.
SET LOCAL stays within short transaction,no network under lock.

## Product pass
Stale/expired workers cannot mark success after contention. Timeout leaves leased
record untouched for existing recovery/reclaim. Effects may already have happened,
so at-least-once effect-before-settlement crash gap remains. No exactly-once or
receipt/sync claim. README/plan precise;defaultOFF unchanged,no production settings/
data action,remote write,baseline advance,accepted sync or external acceptance.
22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI change. Actual480x900 effect summary pixels inspected:counts/timestamps/full
notices readable,separated actions,no horizontal overflow. Scrolled target heading
touches sticky header,summary complete. Browser117 retained real pointer flows.

## Security pass
Lock acquired before checking token/deadline;both mutations while blocked deny
success. Timeout rolls back with no finishedAt/state write. Existing stale-token,
retry/backoff/exhausted lease and DB wall-clock tests retained. No private errors
stored or returned by production helper. No credential scope,spend,registration,
license or audience changes.

## QA/integration pass
Sync323->326:actual pg_stat_activity Lock verified for token change,deadline expiry
and held-beyond2sec cases. Token/deadline changes while blocked returnfalse without
completed state. Timeout is P2010/meta55P03 at2002ms,leased/no finishedAt retained.
Existing live settlement immediately after reset succeeds,showing recovery. Initial
and final326RC0. No failures,startup issues,timeouts or interruption119.

Final43integration/config legs14completed fail-closed batches,all individual+outer
RC0. API248/30,web55/7,both builds,reaper4RC0. Migration13,sync326,browser117,
automation129,webhook45. Native staged116+128=244total/242unique,all242literal
source labels covered,inner+outerRC0,checkpoint removed;not uninterrupted. All app
changes preceded final broad verification;only this review added afterwards.
