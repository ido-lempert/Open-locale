# 0154 - Repository eligibility at each webhook attempt

## Developer pass
Optional internal beforeAttempt guard runs after DNS and before each socket,
including after retry backoff. Repository adapter passes actual current intent
validation transaction. Normal callers omit guard. Guard rejection aborts remaining
attempts for that hook and journals only actual sockets. No network under locks.

## Product pass
Target change/lease expiry between receiver attempts now suppresses stale retry.
Point-in-time guard does not eliminate changes immediately after check or ensure
exactly-once delivery. Still internal explicit webhook helper, no enabled worker,
automation handler/public apply/baseline advance/remote write/external acceptance.
22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI/new control. README states per-attempt check and remaining race. Browser98
retained; no new UI screenshot claim.

## Security pass
Guard exceptions occur outside transport retry catch, so failure cannot send then
retry blindly. Current admin/target/value generation/lease validated from DB each
attempt; initial adapter guard retained for zero-subscriber path. Source request
cannot supply guard or payload. Existing signed/pinned egress remains unchanged.
No external receiver/credential/account/scope/spend/license change.

## QA/integration pass
Webhook30->33 real PostgreSQL/API/HTTP receiver: first500 receiver increments target
revision before replying,second socket suppressed; first500 receiver expires lease,
second socket suppressed; journal records attempts1,not2. Existing end-to-end queue
step and normal retry checks retained. Sync268/browser98. API248/30,web48/7,both
builds,reaper4 RC0.43 integration/config legs in14 clean fail-closed batches,all
individual/outerRC0,48 sweep inventory. Native visual116+128=244 total/242 unique,
all242 source labels covered,inner/outerRC0,checkpoint removed. Staged,not
uninterrupted. TM15442/visual15434 test ports. No test failures/host interruptions88.
No active test services/temp bundles.
