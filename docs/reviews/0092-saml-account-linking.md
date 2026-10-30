# 0092 - SAML account linking

Slice 26. Closes the 409 dead end from 0090: an authenticated user can now
bind a SAML identity to their existing account. Mirrors the OIDC linking
flow's semantics (fresh password, account+epoch binding, single-use state),
carried as an opaque RelayState token instead of OIDC's `state` parameter.

## Difference from OIDC (no parity claim)
OIDC requires the provider-VERIFIED email claim for a new binding. SAML has
no email-verified claim. Here the anti-takeover boundary is the
fresh-password step-up plus the epoch-bound single-use token; the asserted
email is stored on the binding as unverified metadata and is NOT used to
match accounts. Auto-link by email remains forbidden on the plain login path.

## Pass 1 - Developer
- RelayState token: 128-bit random, server-side store {userId, epoch, exp},
  TTL 10min, sweep-on-insert + hard cap 10k (SAML_LINK_MAX) like the other
  SAML stores.
- Token consumed at ACS ENTRY (before validation): single winner, failed
  validation burns it - fail closed like OIDC state.
- Epoch re-checked live at ACS: password change / 2FA toggle after start-link
  invalidates the flow ("Link state is stale").
- Unissued RelayState -> 401. The SP only ever issues RelayState for link
  flows, so an arriving token we did not issue is anomalous; rejecting beats
  silently degrading to a non-link login (test-fixture correction during
  development: the leg originally expected fallback - the strict posture is
  the correct fail-closed reading).
- Plain login path untouched: identity found -> session; unknown identity ->
  provision or 409 exactly as 0090.

## Pass 2 - PM
- Removes the only user-facing dead end in the SAML slice (409 "linking is
  not yet implemented" now has a path). Follow-ups remaining: SP metadata
  endpoint, SP request signing, OIDC/SAML store unification, settings UI.

## Pass 3 - Designer
- API-only; the settings-UI follow-up will need the "connect your SSO
  identity" surface (start-link + result states).

## Pass 4 - Security
- start-link: session-only (API tokens rejected), fresh password required,
  URL carries only the opaque token.
- ACS link branch: epoch staleness 401; identity bound to a different account
  409; token single-use 401; unissued token 401 (and creates nothing).
- A linked account's local 2FA still applies: finish() routes through the
  same pending-2FA gate.
- No crypto added.

## Pass 5 - QA / integration
- saml suite: 36 checks (was 26), ALL PASS, RC=0. New legs: no-session 401,
  wrong-password 401, RelayState present + opaque, happy link binds and
  issues the LINKER's session (asserted email deliberately different from the
  account email), binding row points at the linker, token single-use 401,
  cross-account identity steal 409, plain login after link yields the linked
  account, unissued RelayState 401 + no binding/account created.
- docs-consistency pass (start-link added to openapi.ts, session-only `p`
  like OIDC start-link). Unit api 135/135 unchanged.
- One interim FAIL disclosed and resolved as a test-fixture correction
  (unknown-RelayState expectation), not an app change; no app fixes were
  needed after the first green run.
