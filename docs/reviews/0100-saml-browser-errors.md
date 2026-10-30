# 0100 - Safe browser SAML validation errors

## Developer pass
Once browser RelayState and exact request binding succeed, catch assertion/
account failures and hand off a fixed error result through the existing
verifier-protected ticket. Angular renders fixed copy and restart control,
not raw API diagnostics. API-only validation failures remain normal 401/409.
Structural precheck failures and invalid browser states still fail at the
API boundary; this is not a universal error/cancellation redirect.

Found a real UI defect during regression: navigation to a different fragment
on the same callback route can reuse the component, so OnInit alone did not
consume/scrub the new fragment. Subscribe to Angular's route.fragment and
unsubscribe on destruction. A native hashchange listener was insufficient
because Router uses history state. Reset pending/error state per callback.

## Product pass
A rejected signed assertion in a valid browser flow now yields a readable
restart path instead of raw JSON. No account created; no success token issued.
The backend deliberately uses a generic failure result, not specific issuer/
account messages. More detailed admin diagnostics are separate work.

## Designer pass
Actual desktop validation-error screenshot inspected: safe two-line message,
restart button clearly separated. Actual 480px unsolicited-error screenshot
inspected too, no horizontal overflow. Evidence:
saml-browser-validation-error.png and saml-browser-error-narrow.png.

## Security pass
Error handoff requires valid unexpired exact-request browser state and the
same-tab verifier to redeem. No user/XML/IdP details forwarded. Existing
single-use ticket/expiry/no-store rules still apply. State/precheck failures
remain fail-closed instead of redirecting arbitrary external requests.

## QA/integration pass
SAML browser suite 18 -> 23 checks: valid-state/signed-wrong-issuer yields
fixed-return handoff, browser safe message, no raw diagnostics, no account,
fragment/verifier cleanup. Existing unsolicited callback test now also checks
same-route fragment navigation after a prior callback. First run: 22 PASS,
one FAIL (new same-route fragment not scrubbed). Second run with native
hashchange listener: 20 PASS, timeout on fragment cleanup. Final Angular
fragment-subscription fix: 23 PASS, RC=0. These were app/UI fixes, not fixture
expectation changes. API/web builds and web units pass. Full final-HEAD sweep
and separate visual regression required before closeout.
