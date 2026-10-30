# Review 0086 - In-context host snippet (slice 21)

## Why
The plan bullet is "edit translations live on your own website". The frame
side (shell, CSP, handshake protocol, editing, conflict UI) and the origin
allowlist management existed and were tested. The host side did not: a
customer had to hand-roll the postMessage protocol correctly (source tag,
strict shapes, targetOrigin) to get any integration at all. A wrong
targetOrigin '*' is exactly the class of mistake this feature's security
model exists to prevent, so the protocol needed a served, correct-by-default
host companion.

## What changed
- GET /embed/host.js: a small static companion the customer's page includes.
  OpenLocaleEmbed.init({ iframe }) runs the bounded ping handshake (10 pings
  at 500ms, restarted on every iframe load, plus an immediate cycle for
  iframes that loaded before init), forwards clicks on data-ol-key elements
  as ol:highlight, and re-emits frame replies as CustomEvent('ol:embed').
- Symmetric security posture with the frame: postMessage targetOrigin is
  always the iframe's own origin derived from iframe.src (never '*');
  inbound replies are accepted only from that iframe's contentWindow AND
  that exact origin; no credential ever travels in a message (the frame
  protocol sends none).
- main.ts global-prefix exclusion list gains embed/host.js (the embed
  surface lives outside /api by design; the new route initially landed under
  /api and 404'd at /embed - caught by the first test run, fixed).
- Settings "In-context embedding" copy now points hosts at /embed/host.js.

## Verification (this HEAD)
- incontext suite: 41 PASS / 0 FAIL / RC=0 (was 37; +4: host.js served as
  javascript with no-cache; snippet-only handshake yields a pong CustomEvent
  in real Chrome; click on a data-ol-key element returns ol:highlighted
  found=true; forged message with wrong origin/source ignored by host.js).
- api + web builds RC=0. Interim failures disclosed: web template parse
  error on a literal "{" in the new copy (reworded); host.js route missing
  at /embed (main.ts exclusion list); handshake missed when init ran after
  iframe load (immediate ping cycle added). All caught pre-commit by tests.
- e2e-visual rerun at this HEAD; editor-27-embed-origins.png regenerated
  with the new copy and OCR-inspected.

## Boundaries
- In-context stays PARTIAL: the demo-host validation is local; production
  acceptance on a real third-party host is user-owned. No coverage change.
