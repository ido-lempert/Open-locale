# Review 0081 - Webhook delivery journal + bounded retry (slice 17)

## Why
Webhooks were fire-and-forget with only ephemeral log lines: an admin could not
see whether a delivery succeeded, and one transient receiver hiccup lost the
event. Review also found the event whitelist was out of sync with reality:
mt.service emits mt.pretranslated but the DTO rejected it, so that event could
never be subscribed.

## What changed
- WebhookDelivery journal: one row per event per webhook (event, httpStatus,
  success, attempts, durationMs, error class+message truncated to 200 chars -
  never URL/payload/secret). Bounded retention: the WRITER prunes to the latest
  50 per hook synchronously, so storage cannot grow unbounded without any
  cleanup job.
- Bounded retry: one immediate attempt + one retry after 1.5s backoff,
  covering both network errors and non-2xx responses. A persistently failing
  target shows up in the journal instead of being hammered.
- GET /projects/:id/webhooks/:hookId/deliveries (admin-only, registered in
  openapi.ts): newest-first, journal rows carry no secret/payload/body.
- WEBHOOK_EVENTS gains mt.pretranslated (real defect: emitted but
  unsubscribable).
- Delivery and journaling remain fire-and-forget: neither can fail the
  triggering write (journal failure degrades to log-only, caught separately).

## Verification (this HEAD)
- webhooks suite: 18 PASS / 0 FAIL / RC=0 (was 11; +7: journal records success
  with exact shape, no secret/payload in rows, cross-team journal 404, retry
  succeeds on attempt 2 after a 500, unreachable target journaled as failure
  with attempts=2 and null status, mt.pretranslated subscription accepted).
- api build RC=0; prisma generate RC=0; migration
  20261030103500_webhook_deliveries applied by every suite harness.

## Boundaries kept
- No external webhook registration: all delivery tests target the in-sandbox
  loopback receiver via the fixture-only WEBHOOK_ALLOW_PRIVATE_TARGETS escape
  hatch. Production egress rules (deny ranges, pinned connections, redirect
  refusal) are unchanged and remain what real internet targets get.
- The webhooks coverage item stays PARTIAL: plan acceptance is delivery to
  real external URLs, which needs no new code but does need production
  acceptance outside the sandbox. No auto-promotion on fixture evidence.
