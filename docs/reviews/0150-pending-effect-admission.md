# 0150 - Pending-effect backlog admission

## Developer pass
Internal helper requires Serializable isolation, locks project row, aggregates
pending/leased count and UTF8 key/value bytes. Composition invokes after current
scope validation and before local mutation. Proposed changes included in cap:
10,000 rows/8MiB key names plus set-value bytes. No-op skips admission. Review made
helper independently require isolation/project lock rather than depend on caller.

## Product pass
Pending payload admission only, not total storage accounting. Terminal rows do
not consume pending quota; expired/exhausted leased rows still count. No-op remains
usable. Backlog rejection preserves local values/history/activity rather than
silently discarding effects. No dispatcher/public apply/baseline advance/remote
write/external acceptance.22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI change or new apply control. README/plan state numeric admission limits and
scope. Browser98 retained; no new queue UI screenshot claim.

## Security pass
No payload logged/returned. Database aggregation avoids materializing backlog.
UTF8 bytes, not string length, counted. Project lock/Serializable snapshots force
concurrent producers to serialize or abort rather than exceed final slot. All
production composition admission paths share helper; direct DB writes are not
claimed covered. No credentials/new external effects/registration/spend/license.

## QA/integration pass
Sync255->262 real PG:10k rejects without locale/history/activity mutation,expired
exhausted leased bytes count,Hebrew UTF8 count,no-op despite over-budget backlog,
terminal bytes excluded,simultaneous final-slot producers exactly one commit and
10k total,weak isolation refused. API248/30,web48/7,both builds,reaper4 RC0.
43 integration/config legs in14 clean fail-closed batches,all individual/outerRC0,
48 sweep inventory. Browser98 retained. Native visual116+128=244 total/242 unique,
all242 source labels covered,inner/outerRC0,checkpoint removed. Staged,not
uninterrupted. TM15442/visual15434 test ports. No failures/host interruptions84.
No active test services.
