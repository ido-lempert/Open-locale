# 0147 - Internal bounded effect lease bookkeeping

## Developer pass
One candidate per claim, SKIP LOCKED and atomic row update. Random UUID fencing,
60-second lease, maximum three attempts, retry delay30 seconds times attempt.
Exhausted expired candidates retire but return null, never work for a handler.
Settlement requires matching token and unexpired database wall-clock deadline.
Review replaced transaction-start CURRENT_TIMESTAMP with clock_timestamp to avoid
accepting expired workers inside older transactions. Added direct regression.

## Product pass
No enabled worker, dispatcher, transport or public execution. This is internal
bookkeeping and not exactly-once delivery: a crashed lease may already have caused
an effect. Future handlers need current authority/routing checks and downstream
intent-ID deduplication. completed is bookkeeping, not receipt. Terminal retention
and delivery composition remain code work. No baseline advance, remote write or
external acceptance; coverage22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI change/new apply control. README/plan call out bounded retries and explicit
lack of a dispatcher, terminal retention and exactly-once guarantee. Existing
repository browser98 retained; no screenshot claimed as new queue UI.

## Security pass
No SQL identifiers from callers; parameterized tokens/outcomes/IDs. Wrong, expired
and reclaimed tokens cannot settle. SQL constraints enforce attempts0..3 and state/
lease/finishedAt shape. No raw errors or payloads added to logs. No network under
locks. Lease is not a grant; current dispatch permission is still required.

## QA/integration pass
Sync217->231 real PG: actual concurrent transactions with held claims get disjoint
IDs, active leases excluded, wrong token rejected, completed token replay denied,
expired worker denied before reclaim, renewed token/attempt and stale fencing,
retry backoff, third failure dead, expired final lease retired, future exclusion,
claim rollback, expiry inside old transaction and terminal timestamp constraint.
API248/30,web48/7,both builds/reaper4 RC0; final API build repeated after clock fix.
43 integration/config legs in14 completed clean fail-closed batches, every
individual/outerRC0,48 sweep inventory. Browser98 retained. Native visual116+128=
244 total/242 unique,all242 source labels covered,inner/outerRC0,checkpoint removed.
Staged verification, not uninterrupted. TM15442/visual15434 isolated test ports.
No failing test runs or host interruptions in this slice. Review fixes were made
before final verification. No active test services.
