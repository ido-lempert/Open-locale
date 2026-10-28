# 0029 - In-context embedding, boundary-first slice

## What shipped
- `Project.embedOrigins` (String[]): the allowlist of host-page origins that may
  embed and message the in-context editor. Bare http(s) origins only - no path,
  query, trailing slash, credentials, or other schemes (400 otherwise).
- Origin management is admin AND session-only (403 for API tokens, even
  write-scope): a leaked CI/SDK token must not widen the postMessage trust
  boundary. Ordinary project updates over tokens are unaffected. Changes are
  recorded in the activity log (`project.embedOrigins.updated`).
- `/embed/projects/:id` (web): minimal in-context frame. Loads project + keys
  for a branch (`?branch=`, default main) with the frame's own session.
  Protocol:
  - Host -> frame: `{source:'open-locale-host', type:'ol:ping'}` or
    `{source:'open-locale-host', type:'ol:highlight', key:<string>}`.
    Strict shape: unknown types, extra fields, non-object payloads, and
    non-string keys are ignored.
  - Frame -> host: `{source:'open-locale-embed', type:'ol:pong'|'ol:highlighted',
    ...}`, posted only to the verified `event.origin` of a valid inbound
    message - never `*`, never to an origin that has not spoken first.
  - Origin check runs before payload inspection. Non-allowlisted origins get
    silence.
  - The session token never leaves the frame: no message payload contains it
    (asserted), and replies carry only counts and key names.
- Settings UI: "In-context embedding" panel (list, add, remove, explanation).
- scripts/incontext-test.mjs: 22 checks. Part A over real PostgreSQL + HTTP
  (validation matrix, token/member/session access rules, activity record).
  Part B in a real browser with the frame embedded from two separate local
  origins: allowlisted origin gets pong/highlight replies; malformed payloads
  get silence; the non-allowlisted origin gets no messages at all; no payload
  ever contains the JWT.

## Explicit limits
- The frame is read-only this slice: highlight + browse. Editing from the host
  page is a later slice and will need its own write-path review (permissions
  per locale, optimistic concurrency, activity attribution).
- Frame loads the full key list of one branch (same data the member can read);
  no pagination yet.
- The app sends no frame-ancestors CSP or X-Frame-Options yet; the allowlist
  is enforced at the message boundary, not at embed time. Any site can iframe
  the URL but receives nothing. Clickjacking hardening (frame-ancestors from
  embedOrigins) is the natural next hardening slice.
- Host-side snippet/SDK is documented only by the protocol above; no published
  JS snippet yet.

## Review passes
- Developer: migration hand-written (`embedOrigins TEXT[]`), service validation
  with dedupe, strict message-shape validator, builds green.
- PM: settings copy explains exactly what an origin grants; empty state says
  the endpoint answers nothing until allowlisted.
- Designer: settings panel consistent with existing panels; embed frame is a
  compact key list with a visible highlight state; waiting state explains why
  the frame is quiet.
- Security: origin-before-payload, strict schema, targeted replies, token
  hygiene asserted in-browser, session-only origin management, activity audit.
- QA/integration: 22-check suite incl. real cross-origin browser runs on two
  ports; e2e-visual covers the settings panel (editor-27).
