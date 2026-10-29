# 0037 - OIDC groundwork (local mock issuer only)

Scope: authorization-code + PKCE sign-in and account linking against a
CONFIGURABLE issuer, developed and verified exclusively against the local
mock issuer in scripts/mock-oidc.mjs. No external IdP is enrolled, no
provider account or credentials exist, no real user is involved, and nothing
here is claimed SSO-ready for production. All fixture accounts are @t.dev
test users.

## Endpoints
- GET /auth/oidc/start (public): returns the issuer authorization URL with
  state, nonce and S256 PKCE challenge. 404 when OIDC_ISSUER is unset.
- GET /auth/oidc/start-link (session JWT): same, but the resulting identity
  binds to the signed-in account.
- POST /auth/oidc/callback {code, state}: consumes state (single-use),
  exchanges the code with the PKCE verifier, validates the id_token, then
  signs in / links / provisions.
- POST /auth/oidc/complete {pendingToken, totpCode}: finishes login for
  accounts with local 2FA enabled.

## Security properties (all tested in scripts/oidc-test.mjs, 38 checks)
1. SSRF / network guard at the connection, not just the URL: https
   everywhere; http+loopback is a development exception that is impossible
   in production (tested 400); non-loopback hosts must resolve to PUBLIC
   IPs only - private/loopback/link-local/CGNAT/reserved ranges rejected at
   request time (tested: private-range https issuer -> 400). All
   discovery/token/JWKS fetches go through one guarded path: DNS re-check
   per call, redirect: 'error' (tested: a metadata endpoint that 302s makes
   /start fail, not follow), 5s timeout, 64KB response cap. The metadata's
   issuer must match the configured issuer exactly and authorization/token/
   JWKS endpoints must stay on the issuer origin (redirect allowlist).
   Pinning: all egress goes through apps/api/src/app/egress/pinned.ts - the
   hostname is resolved, every address checked against the webhook deny
   list (IPv4 ranges, IPv6 forms, IPv4-mapped/NAT64/6to4/Teredo), and the
   connection is made to the validated IP itself, closing the
   lookup->connect TOCTOU window. TLS authenticates the ORIGINAL hostname
   (SNI + default certificate identity checks) while connected to the
   pinned IP, with the default CA store. Unit evidence
   (egress/pinned.spec.ts, openssl-generated CA + certs): good cert over
   pinned IP succeeds, hostname-mismatched cert rejected, untrusted-CA
   cert rejected, redirect refused, 64KB cap, timeout, mapped-IPv6
   literal denied. Integration evidence: the full flow with the issuer as
   a hostname (localhost) succeeds and the mock observes the original
   Host header on the pinned token request.
2. State: random 128-bit, single-use (synchronous consume-before-network,
   so concurrent callbacks have exactly one winner - tested), 10-minute
   TTL (OIDC_STATE_TTL_MS), in-memory so an API restart fails closed.
   Unknown/replayed state -> 401 (tested). start returns ONLY the
   authorization URL - the PKCE verifier never leaves the API (tested).
3. PKCE: S256 verifier kept server-side in the state entry; the issuer
   verifies the challenge (tested end-to-end).
4. id_token: RS256 signature verified against the issuer JWKS by kid;
   iss must equal the configured issuer, aud must contain the client id,
   exp must be in the future, nonce must equal the state nonce. Wrong
   nonce / aud / iss / expiry / signature / missing nonce all -> 401
   (tested via the mock's test-only /mint-code).
5. Linking / takeover: identities are matched by (issuer, subject) only.
   An SSO login whose email matches an existing local account is REFUSED
   (409) unless it went through the authenticated start-link flow - no
   email-based auto-linking (tested, including that no identity row is
   created by the refused flow). start-link requires fresh auth (current
   password - tested 401 on wrong password and without a session) and the
   state is bound to the initiating account AND its authEpoch: a 2FA
   enable/disable between start and callback invalidates the link state
   (tested 401), and the callback can never bind the identity to a
   different account - an identity already linked elsewhere is a 409
   (tested). New emails provision a fresh account with an empty password
   hash; password login can never succeed for it (tested). Concurrent
   first-login binding falls back to the unique (issuer, subject) winner.
   Provisioning AND new bindings require the provider's email_verified
   claim to be true; unverified emails are refused 400 and create nothing
   (tested).
6. Local 2FA interaction: SSO login to a TOTP-enabled account returns
   requiresTwoFactor + a single-use 5-minute pending token; only after the
   account's own TOTP/recovery check passes does the API issue a session,
   with mfa=true (tested end-to-end, including wrong-code rejection, that
   the pending token is consumed on failure, and that simultaneous
   completes with the same pending token have exactly one winner).
   Shared gate: SSO completion and password login use the SAME
   attemptSecondFactor path - persistent lockout, atomic failure
   increments, replay/counter and epoch enforcement all live on the user
   row, so repeated SSO starts cannot farm unlimited TOTP attempts
   (tested: 3 SSO + 2 password failures trip the shared lock; the 6th
   attempt is refused on both paths even with a valid code).
   Passwordless accounts and 2FA management: password step-up on an
   SSO-only account returns a clear 403 ("This account has no password
   (SSO-only)...") instead of trapping the user in an unsatisfiable
   prompt (tested). The escape - a set-password flow for SSO accounts -
   is future work; until then password-confirmed management is visibly
   unavailable to them.
7. Sessions issued by SSO carry the account authEpoch like password
   sessions, so 2FA enable/disable revocation applies uniformly.

## Documented limits
- In-memory state/pending stores: single-process only; a multi-instance
  deployment needs a shared store. Restart invalidates in-flight logins.
- No userinfo call, no id_token at_hash check (no access token use), no
  logout/backchannel. Groundwork, not a certified client.
- The mock issuer's /mint-code (arbitrary-claim signing) is a test harness
  surface that exists only in the local mock.
- No UI yet: flows are exercised over HTTP only.
