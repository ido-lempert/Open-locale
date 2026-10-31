# 0153 - Internal queue-to-webhook single step

## Developer pass
Explicit helper connects existing single-intent runner and webhook adapter. No new
transport,duplicate queue implementation,timer/startup registration or public route.
Current guard runs before handler and adapter rechecks immediately before delivery.
Handler resolves after actual transport aggregate,then runner token-fenced settle.

## Product pass
Webhook channel only,not automation or overall sync completion. A combined worker
must introduce independent channel completion before production use. Partial receiver
success may repeat on retry;stable effectId supports receiver deduplication. No
subscribers is no failure,not receipt. No public apply/baseline advance/remote write
or external acceptance;22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI/new control. README/plan name explicit internal webhook-only helper and lack
of combined worker/automation completion. Browser98 retained,no new UI screenshot.

## Security pass
No network while database locks held. Actual current intent guard and signed/
DNS-pinned pipeline reused. Changed target blocks all receiver traffic. Failure
requeues with bounded attempts/backoff;expired settlement cannot claim completion.
No external receiver/credentials/registration/spend/license or worker activation.

## QA/integration pass
Webhook24->30 actual DB/API/HTTP receiver:claim/delivery/completed state,attempt1,
released token,finishedAt,stable effectId;completed step idle/no redelivery;500 twice
requeues pending;immediate retry idle during backoff;due retry succeeds attempt2
same effectId;changed target step ineligible/no socket. Existing direct adapter
set/removal/signature checks retained. Sync268/browser98. API248/30,web48/7,both
builds,reaper4 RC0.43 integration/config legs in14 clean fail-closed batches,all
individual/outerRC0,48 sweep inventory. Native visual116+128=244 total/242 unique,
all242 source labels covered,inner/outerRC0,checkpoint removed. Staged,not
uninterrupted. TM15442/visual15434 test ports. No failures/host interruptions87.
No active test services/temp bundle files.
