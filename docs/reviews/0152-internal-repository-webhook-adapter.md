# 0152 - Internal repository webhook handler adapter

## Developer pass
Adapter revalidates current intent using actual Serializable guard immediately
before calling existing webhook service outside locks. Service now returns aggregate
matched/succeeded/failed from settled per-hook outcomes; existing callers may ignore
return. Failed receiver aggregate makes adapter throw so runner can retry. No timer,
worker registration or production composition connected. Automations still separate.

## Product pass
Set event translation.updated; removal translation.removed with null, not empty.
EffectId provided for receiver deduplication. Partial receiver success may repeat
on retry, at-least-once not exactly-once. No subscriptions is zero failure, not
proof of receipt. Current routing checked by existing active-event query; no new
receiver configured outside local fixture. No public apply/baseline/remote changes.
Coverage22FULL/7PARTIAL/1MISSING unchanged, no external acceptance.

## Designer pass
No web UI change. Removal event subscribable through authenticated API, not yet a
new settings checkbox. README names that gap. Existing browser98/native UI retained;
no new UI screenshot claim.

## Security pass
Same signed DNS-pinned/SSRF-checked delivery pipeline, no alternate transport.
Current eligibility rechecked before socket path, transaction ends before delivery.
Point-in-time checks do not eliminate later revocation/routing races. Payload uses
validated database intent, not caller-modified values. Failure throws generic text,
existing operational journal policy unchanged. No secrets included in aggregate.
No external registration/token expansion/spend/license or worker activation.

## QA/integration pass
Webhook18->24 real PostgreSQL/API/local HTTP receiver: API removal subscription,
exact signed effectId/set payload,exhausted500 failure surfaced,changed target no
socket,distinct removal/null,current disabled subscription no delivery. Uses actual
service and adapter bundled from source with real database/transport; not claimed
as complete queue-to-webhook production integration. Sync268/browser98 retained.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs in14 clean
fail-closed batches,all individual/outerRC0,48 sweep inventory. Native visual116+
128=244 total/242 unique,all242 source labels covered,inner/outerRC0,checkpoint
removed. Staged,not uninterrupted. TM15442/visual15434 test ports. No test failures
or host interruptions during recovered implementation run. Earlier21:05 activation
failure prevented any mutation; recovered21:15 and parent informed. No active
services or temporary bundle files remain.
