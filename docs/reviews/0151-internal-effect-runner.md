# 0151 - Internal one-intent runner composition

## Developer pass
Single claim, current Serializable eligibility, handler after transaction resolves,
then token-fenced settlement. Invalid contexts never invoke handler; bounded retry
for eligibility/handler failure, stale status when settlement fence lost. No timer,
startup registration or production handler. Errors not exposed in result. Claim/
settlement storage errors propagate rather than false completion.

## Product pass
Internal composition only, not production delivery or exactly-once. completed is
queue bookkeeping, not receipt. Handlers must be bounded and recheck routing/
authority; crash/expired handler may already have caused effect and be retried.
No enabled worker/public apply/baseline advance/remote write/external acceptance.
22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI change/new apply control. README/plan name internal runner and missing
production handlers. Browser98 retained, no new queue UI screenshot claim.

## Security pass
Handler cannot run until all database guard locks released. Invalid current scope
blocked; live token settlement rejects late completion. Raw private exception text
not returned/logged. Eventual handler owns current authority/routing and intent-ID
deduplication. No external request/credential/registration/spend/license change.

## QA/integration pass
Sync262->268 real PG: handler acquires same project lock with1sec lock timeout
proving prior guard transaction released; exact context; completed idle replay;
actual overlapping runners invoke active intent once; handler failure requeues
without locale/history/activity changes; invalid revision invokes no handler;
expired handler reports stale, leaves leased rather than false completion.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs in14 clean
fail-closed batches,all individual/outerRC0,48 sweep inventory. Browser98 retained.
Native visual116+128=244 total/242 unique,all242 source labels covered,inner/outer
RC0,checkpoint removed. Staged,not uninterrupted. TM15442/visual15434 test ports.
No failing runs/host interruptions85. No active test services.
