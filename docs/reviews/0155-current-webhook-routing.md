# 0155 - Current captured webhook routing at every socket

## Developer pass
Before every attempt, reread hook by ID and require same project,active,event
subscription,exact URL and signing secret as captured. Change aborts captured
delivery instead of moving payload to newly edited destination. Applies to normal
and repository callers. Existing source guard runs first; no DB locks over socket.

## Product pass
Disabled/deleted/unsubscribed hook,destination edit or signing-key rotation during
backoff suppresses stale retry. No guarantee for edits immediately after final
check. No timer/public apply/automation worker/baseline/remote changes. Coverage
22FULL/7PARTIAL/1MISSING unchanged,no external acceptance. Queue retry can later
use current subscription routing;exactly-once still not claimed.

## Designer pass
No UI changes/new control. README names current routing check and remaining race.
Browser98 retained,no new UI screenshot claim.

## Security pass
No stale captured destination or signature retry after observed change. Generic
error excludes routing/secret values. Existing DNS-pinned/SSRF checks still govern
socket. No new external receiver/credentials/account/scope/spend/license. Check
and network are separate on purpose,not a permanent revocation guarantee.

## QA/integration pass
Webhook33->38 actual PostgreSQL/API/HTTP receiver. First500 receiver disables hook,
edits URL,unsubscribes event,rotates secret or deletes hook before reply;each case
has exactly one request,not second old/new routing socket. Fixture restores hook
between cases. Existing signed payload,queue retry/current-context checks retained.
Sync268/browser98. API248/30,web48/7,both builds,reaper4 RC0.43 integration/config
legs in14 clean fail-closed batches,all individual/outerRC0,48 sweep inventory.
Native visual116+128=244 total/242 unique,all242 source labels covered,inner/outer
RC0,checkpoint removed. Staged,not uninterrupted. TM15442/visual15434 test ports.
No failures/host interruptions89. No active test services/temp bundle files.
