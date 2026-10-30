# 0101 - Consume OIDC query callbacks on reused Angular routes

## Developer pass
OnInit only runs once per component. Angular query-only navigation reuses
the OIDC callback, so a second query could remain unprocessed/unscrubbed.
Subscribe to route.queryParamMap, reset pending/error/busy state per event,
and unsubscribe on destruction, mirroring the confirmed SAML route fix.
No server verifier or session-storage policy changes.

## Product pass
A new callback on an already-mounted page must show its own result, not a
stale cancellation message. Unsolicited callback still fails before code
exchange; expected state is consumed and code removed from history.

## Designer pass
Inspected actual 480x800 error capture after reused-route test: fixed copy
wraps cleanly, restart button separated, no horizontal overflow. No template
or style changes in this slice. Evidence: oidc-error-narrow.png.

## Security pass
Preserve exactly-one code/state and same-tab checks before exchange. Query
scrubbing now also runs for same-route navigation. No new authorization or
provider scope. This is a specific lifecycle fix, not blanket SSO completion.

## QA/integration pass
OIDC browser 21 -> 24 checks. New checks drive Angular Router (not page.goto,
which reloads the document): same-route query scrubbed, no code exchange,
previous cancellation message cleared. Test uses Angular debug component
access only to invoke Router in the local dev test, not production code.
Discrimination run with original HEAD component and new test: 20 PASS then
30-second timeout at cleanup condition, RC=1. Restored fix: 24 PASS, RC=0.
Initial fixed run also 24 PASS. API unaffected. Web build/unit RC=0 (24 unit
checks unchanged). Full sweep and visual regression at final HEAD before push.
