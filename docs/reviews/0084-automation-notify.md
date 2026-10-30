# Review 0084 - Automation notify action (slice 19)

## Why
The plan bullet reads "Automations: trigger-based rules - on key change,
pre-translate, create task, notify." The first three existed; notify did not.
A notification that sends email or chat messages is an external effect (the
PARTIAL boundary). The local, authorized part: dispatch the project's
admin-managed webhooks with a new automation.notify event.

## What changed
- New action `notify`, config { message (max 200 chars, {key} templating) }.
  On fire it calls the existing webhook pipeline: signed (HMAC), journaled,
  bounded-retry delivery to every active project webhook subscribed to
  automation.notify.
- WEBHOOK_EVENTS gains automation.notify; OpenAPI action list updated.
- No new routes; rule CRUD stays admin-only.

## Five passes
- Developer: mirrors the task.create branch; build RC=0; no dead code.
- PM: closes the plan bullet's fourth action locally. Automations stays
  PARTIAL: delivery to real external endpoints is production acceptance
  (user-owned), per the no-auto-promote rule.
- Designer: no rules UI exists (API surface only) - no visual change.
- Security: the rule config names NO URL, so rule authors cannot aim egress
  anywhere new; targets remain admin-managed webhooks behind the existing
  SSRF validation (URL rules, DNS pinning, private-target deny). Message
  bounded at 200 chars; deliver never re-fires rules (no recursion); the run
  is journaled in activity with trigger actor and run-as creator.
- QA: +7 transport-level legs in automations-test.mjs with a real loopback
  receiver (400 on missing message, event subscription, rule create,
  signed delivery received, key/message interpolation, HMAC verified against
  the one-time secret, activity record).

## Verification (this HEAD)
- automations suite: 30 PASS / 0 FAIL / RC=0 (was 23).
- api build RC=0. Full sweep at the final HEAD reported with the commit.
