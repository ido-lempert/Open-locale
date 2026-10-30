# 0096 - Browser OIDC sign-in and second-factor completion

## Developer pass
Add /auth/oidc/info (only a configured boolean), show SSO alongside password
login when configured, and add the actual Angular /auth/oidc/callback route.
Store only the opaque authorization state in sessionStorage for this tab.
Remove it exactly once on callback, scrub code/state from browser history
before the exchange, and keep pending second-factor tokens in memory only.
Successful sessions use the existing app token storage and projects route.
API/Angular builds pass. No changes to the server OIDC verifier.

## Product pass
This closes an actual missing browser path, not merely a configuration
panel. Password login still works when OIDC is absent/unavailable. Errors
explain how to restart. A failed second-factor submission consumes the
server token, so the UI removes the form and offers a new sign-in instead
of suggesting a retry with consumed state. SAML browser completion,
SSO-only password setup, browser linking controls and external-IdP
acceptance remain separate work, not owner-permission gates.

## Designer pass
Inspected actual pixels: 1280x800 sign-in and second-factor screens, plus
480x800 cancellation error. Fixed crowded spacing between finish/restart
buttons and inspected the new second-factor capture. Clear input labels,
visible errors and restart button; narrow error page does not overflow.
Evidence: oidc-login-browser.png, oidc-second-factor-browser.png,
oidc-error-narrow.png. Existing settings UI unchanged.

## Security pass
The callback requires a same-tab initiation state, exactly one matching
state and exactly one nonempty code before making any exchange request.
Unsolicited, duplicate and refresh callbacks fail before token exchange.
Provider error values are not rendered; cancellation uses fixed safe text.
State is not a replacement for server PKCE/nonce/signature verification.
No tokens in redirect URLs; authorization query parameters removed before
API I/O; pending token/code are not persisted to browser storage. The app's
existing JWT localStorage policy is unchanged, not newly certified safe.

## QA/integration pass
New oidc-browser suite uses real Chrome, Angular, mock IdP, built Nest API
and embedded Postgres. 21 PASS, RC=0. Covers button/password availability,
real redirected login, protected endpoint authentication, one exchange,
URL scrubbing, consumed tab state, provisioning, second-factor prompt,
one-use recovery completion, wrong-code restart, unsolicited and duplicate
state/code rejection before API exchange, refresh rejection, provider
cancellation and 480px overflow. The second-factor fixture sets enabled
state/recovery hash directly in DB; it tests real recovery verification,
not TOTP enrollment. Local mock acceptance only, never external acceptance.

Two targeted runs passed (19 then 21 as duplicate-code/refresh coverage was
added). Replaced an initially weak authenticated-arrival assertion with a
real protected HTTP read carrying the stored session token. API/web build
RC=0; web unit 24 PASS RC=0; docs 4 PASS RC=0. The browser suite is registered
in package scripts and the full sweep (40 -> 41 legs). Full visual regression
is separate from the sweep, as before.
