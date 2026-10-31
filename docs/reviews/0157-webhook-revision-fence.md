# 0157 - Captured webhook routing generation fence

## Developer pass
Webhook revision default1 migration. Every authenticated update atomically increments
revision alongside fields. Each socket compares captured/current revision in
addition to fields,so edit/restore ABA cannot resume old delivery. Existing public
view unchanged,no secret/revision disclosure added. Out-of-band DB edits must
maintain revision themselves;not claimed to cover restored raw SQL changes.

## Product pass
Disable/restore and destination edit/restore during retry backoff now abort captured
retry even when final fields equal originals. New invocation may use current
configuration. Still at-least-once and point-in-time,not permanent revocation or
exactly-once. No enabled worker/public apply/automation handler/baseline/remote
change/external acceptance;22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI/control change. README names API-update generation and raw DB limitation.
Browser98 retained,no new UI screenshot claim.

## Security pass
Atomic revision increment prevents lost concurrent increment. Before-socket checks
still require current active/subscription/project/URL/secret fields too. Generic
routing-change error excludes private values. No network under locks and remaining
post-check race explicit. No credentials/account/scope/spend/license change.

## QA/integration pass
Webhook42->45 actual PostgreSQL/API/HTTP receiver. First500 receiver performs
PATCH disable then enable;retry suppressed despite active=true. Separately PATCH
temporary URL then original;retry suppressed despite URL restored. All four API
updates200 and stored revision+4. Existing socket/current-source/signature/queue
checks retained. Sync268/browser98. API248/30,web48/7,both builds,reaper4 RC0.
43 integration/config legs in14 clean fail-closed batches,all individual/outerRC0,
48 sweep inventory. Native visual116+128=244 total/242 unique,all242 source labels
covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted. TM15442/
visual15434 test ports. No failures/host interruptions91. No active test services.
