# 0156 - Independent webhook handler checkpoint

## Developer pass
Nullable webhookHandledAt migration,legacy rows retry channel. Explicit webhook
step skips checkpointed channel,otherwise actual delivery then token/state/deadline-
fenced SQL checkpoint before queue settlement. Channel state survives requeue.
No new worker/timer/public route. Automations have no checkpoint/handler yet.

## Product pass
Handled means handler completed,including zero subscribers,not receiver receipt.
Crash after socket before checkpoint still at-least-once and may repeat. Combined
worker must separately track automation handling before claiming overall completion.
No public apply/baseline advance/remote write/external acceptance;coverage22FULL/
7PARTIAL/1MISSING unchanged.

## Designer pass
No UI/control. README/plan distinguish independent channel bookkeeping from sync
completion. Existing browser98 retained,no new queue UI screenshot claim.

## Security pass
Checkpoint cannot be written by expired/stale lease token. Requeued checkpointed
intent still passes current eligibility via runner before skipping channel. No
secrets/payload copies added;project cascade/terminal retention remain. No external
receiver/registration/token expansion/spend/license or worker activation.

## QA/integration pass
Webhook38->42 actual PostgreSQL/API/HTTP receiver: successful step checkpoint,
requeue checkpointed intent no second socket and same checkpoint timestamp,failed
receiver leaves checkpoint null,receiver expires lease after200 delivery so stale
step cannot checkpoint/complete. Existing retry/signature/current routing retained.
Sync268/browser98. API248/30,web48/7,both builds,reaper4 RC0.43 integration/config
legs in14 clean fail-closed batches,all individual/outerRC0,48 sweep inventory.
Native visual116+128=244 total/242 unique,all242 source labels covered,inner/outer
RC0,checkpoint removed. Staged,not uninterrupted. TM15442/visual15434 test ports.
No failures/host interruptions90. No active test services/temp bundle files.
