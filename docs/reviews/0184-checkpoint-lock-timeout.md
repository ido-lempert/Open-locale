# 0184 - Bound rule and channel checkpoint lock waits

## Developer pass
Rule and shared webhook/automation channel checkpoint writers set transaction-local
lock_timeout=2s before intent row lock. Clock/token evaluated only after lock,as
before. Failed transaction cannot insert rule ledger or mark channel handled. Same
live writers recover after contention. Per-lock bound only,not whole worker tick,
claim,settlement,network or shutdown drain. SET LOCAL cannot persist into pool.

## Product pass
Checkpoint contention has a bounded individual wait. An effect can already have
happened before checkpoint timeout;retry may duplicate uncheckpointed work. No
exactly-once/delivery/sync acceptance claim. README/plan document scope. DefaultOFF
flags unchanged,no production settings/data action,remote write,baseline advance,
accepted sync or external acceptance.22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI change. Actual480x900 effect summary pixels inspected:counts/timestamps and
full bookkeeping/worker-unknown/retention notice readable,separate actions,no
horizontal overflow. Existing scrolled target heading touches sticky header but
summary complete. Browser117 retained actual pointer-driven summary/apply flows.

## Security pass
Timeout fails closed,never grants checkpoint success or delivery authority. Existing
stale token/deadline and lock-before-clock tests retained. No raw private errors
stored in intent/logged by production helpers. No credential scope,spend,
registration,license or audience changes. At-least-once crash gaps remain.

## QA/integration pass
Automation123->129:six new actual PG tests. Independently holds intent row for rule,
webhook and automation writer;P2010/meta55P03 after~2sec,all channel timestamps/ledger
absent. Releases actual lock;each live writer succeeds. Initial and final129RC0.
Existing actual token-reclaim/deadline lock contention tests remain green.
No failures,startup issues,timeouts or interruption118.

Final43integration/config legs14completed fail-closed batches,all individual+outer
RC0. API248/30,web55/7,both builds,reaper4RC0. Migration13,sync323,browser117,
automation129,webhook45. Native staged116+128=244total/242unique,all242literal
source labels covered,inner+outerRC0,checkpoint removed;not uninterrupted. All app
changes preceded final broad verification;only this review added afterwards.
