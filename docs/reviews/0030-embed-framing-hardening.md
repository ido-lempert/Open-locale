# 0030 - Embed framing hardening (clickjacking + message boundary)

## What shipped
- The embed frame moved from an Angular SPA route to an API-served shell
  (`GET /embed/projects/:id`, outside the /api prefix) so each response carries
  a per-project `Content-Security-Policy` header with
  `frame-ancestors 'self' <embedOrigins...>` built from the live allowlist.
  An empty allowlist yields `frame-ancestors 'self'` - not embeddable anywhere
  external. CSP is asserted on the served HTML response, not inferred.
- Shell CSP: `default-src 'none'; script-src 'self'; style-src 'self';
  connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'` -
  no inline script/style in the shell (frame.js / frame.css served separately).
  The shell HTML carries no project data; keys load over the authenticated API.
- The frame authenticates with its OWN sign-in form (API origin localStorage).
  Unauthenticated frames render only the form: no key data, and host messages
  are ignored entirely.
- Message boundary (unchanged protocol, stricter checks, in order):
  1. `event.source === window.parent` - only the direct embedder; a same-origin
     sibling frame on an allowlisted page messaging the embed directly is
     ignored (tested with a two-frame page).
  2. `event.origin` in the project's live allowlist.
  3. Strict payload shape (`ol:ping`, `ol:highlight`); everything else ignored.
  Replies go only to the verified `event.origin`, never `*`.
- docs-consistency now explicitly excludes embed.controller (not REST surface).

## Verified (scripts/incontext-test.mjs, 37 checks, real PG + HTTP + Chrome)
- CSP header contents with one origin, with empty allowlist, and 404 for
  unknown project; shell not double-mounted under /api.
- Nested chain: evil outer origin -> allowlisted middle -> embed is blocked by
  the browser (no pong beacon) until the outer origin is also allowlisted
  (positive control then passes).
- Revocation: removing all origins blocks the NEXT fresh load (CSP is
  per-response). An already-open frame keeps its loaded allowlist until
  reload - stated here, not hidden.
- Failed-auth frame: sign-in form only, no key names in the DOM, host messages
  unanswered; after in-frame sign-in the keys render and the protocol works.
- Sibling-source, malformed-payload, and token-hygiene checks from slice one
  all re-run green against the new shell.

## Explicit limits (no blanket secure-embedding claim)
- CSP frame-ancestors is enforced by the browser at load time; it does not
  remove the need for the message-boundary checks (defense in depth, both
  tested).
- Revocation applies to fresh loads; open frames are not killed mid-session.
- A compromised allowlisted origin is still trusted - the allowlist is the
  trust decision, and this slice does not attempt to detect hostile
  allowlisted pages beyond the source/scope checks above.
- Read-only: no edit writes from the host page. Edit intents will need their
  own write-path review (per-locale permissions, concurrency, attribution)
  before anything ships.
- X-Frame-Options is not set (cannot express an origin list); modern browsers
  use frame-ancestors. Noted for very old browsers only.
