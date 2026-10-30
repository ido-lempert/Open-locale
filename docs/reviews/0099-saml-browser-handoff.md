# 0099 - Browser SAML sign-in with verifier-bound one-use handoff

## Developer pass
Add browser/start and browser/redeem, retaining JSON ACS compatibility for
API flows. Browser login generates a same-tab verifier and sends its SHA256
challenge. Server records the exact AuthnRequest and opaque browser RelayState.
After normal node-saml validation the ACS stores the result under a 60-second
one-use ticket and redirects 303 to a fixed configured web URL, ticket in
fragment. Redemption requires the verifier; no session JWT appears in a URL.
Flow/ticket stores cap at 1000; expired entries pruned on insert. Request
purpose tombstones reject missing RelayState even after consumed state.
Five unit cases cover request/state binding, stripping, wrong-verifier burn,
one-use success, expiry and store cap/recovery. Process-local only.

## Product pass
Enable the SAML button only with SAML_BROWSER_RETURN_URL configured. Existing
password/OIDC flows retained. The Angular callback scrubs the fragment before
redemption and presents local second-factor/recovery completion. Invalid
second factor requires restarting because pending tokens are consumed.
Server ACS validation errors still return JSON errors, not a styled browser
failure redirect; account-link browser controls and cancellation/retry polish
remain future work. External IdP acceptance remains unverified.

## Designer pass
Inspected actual screenshots at desktop 1280x800 and error 480x800: SAML
button sits above login tabs, second-factor labels/action/restart are readable
and spaced, narrow error wraps without overflow. Evidence filenames:
saml-browser-login.png, saml-browser-second-factor.png,
saml-browser-error-narrow.png. No alignment/crop problems observed.

## Security pass
Fixed server return URL only; HTTPS except loopback, no credentials/query/
fragment allowed in config. No caller-controlled redirect target. Handoff
fragment is not a JWT and requires a separately stored verifier; wrong
verifier burns the ticket. Redemption and ACS set no-store; ACS no-referrer.
Browser state exact-request binding plus node-saml signature/replay checks
remain necessary. Invalid browser state cannot fall into ordinary API
provisioning. The existing JWT localStorage policy is unchanged, not newly
certified safe. No external accounts or provider registration used.

## QA/integration pass
New real Chrome/Angular/mock IdP/Nest/Postgres saml-browser suite: 18 PASS,
RC=0. Real IdP HTML form POST -> ACS -> redirect -> redeem -> projects,
protected HTTP authentication, verifier/fragment cleanup, provisioning,
second-factor/recovery completion and database consumption, unsolicited
callback before redemption, 480px overflow. HTTP negative legs prove stolen
handoff without verifier rejects, wrong verifier burns ticket, browser state
replay rejects, ACS response is no-store 303 without JSON accessToken.
Second-factor fixture sets enabled/recovery hash directly: recovery path,
not TOTP enrollment. Two targeted runs passed (14 then 18 as HTTP negative
legs added). No interim failed runs. Existing SAML suite 55 PASS unchanged;
API units 150 -> 155, 20 -> 21 suites; build RC=0, docs 4 PASS. Register new
suite in package scripts/sweep (41 -> 42 legs). Full visual suite remains
separate; run it at final HEAD alongside settled sweep evidence.
