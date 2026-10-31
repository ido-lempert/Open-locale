# 0149 - Bounded internal terminal-effect retention

## Developer pass
One parameter-free SQL CTE locks at most100 completed/dead rows older than seven
days by database wall clock, deletes only those IDs, returns count only. Stable
finishedAt/id order and SKIP LOCKED permit concurrent cleanup without duplicate
selection or waiting on held terminal rows. No scheduled caller in this stage.

## Product pass
Seven-day terminal payload retention only. Pending/leased work is never age-pruned,
even if expired/exhausted. Existing project deletion still cascades all private
payloads. This is not a bounded total queue: pending backlog/dispatch limits and
actual scheduled cleanup remain integration work. No delivery/public apply/baseline
advance/remote write/external acceptance.22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI changes/new apply control. README/plan explicitly name internal unscheduled
helper and remaining pending backlog/dispatch work. Browser98 retained, no new
queue UI screenshot claim.

## Security pass
No caller-selected cutoff, SQL identifier or deletion scope. Only terminal rows
with old finishedAt eligible. No translation payload returned or logged. Cleanup
is transactional and project cascade still applies. No API/credential/audience/
registration/spend/license change. Not a dispatcher or execution grant.

## QA/integration pass
Sync247->255 real PG:100-row cap, concurrent held old row skipped, simultaneous
cleanup disjoint totals, old pending and expired exhausted leased preserved,
recent terminal preserved,idempotent empty pass,rollback and six-day protection.
API248/30,web48/7,both builds/reaper4 RC0.43 integration/config legs in14 completed
clean fail-closed batches, every individual/outerRC0,48 sweep inventory. Browser98
retained. Native visual116+128=244 total/242 unique,all242 source labels covered,
inner/outerRC0,checkpoint removed. Staged,not uninterrupted. TM15442/visual15434
isolated ports. No failures/host interruptions83. No active test services.
