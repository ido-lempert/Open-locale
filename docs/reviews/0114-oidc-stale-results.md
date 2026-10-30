# 0114 - Discard stale OIDC browser results

## Developer pass
A monotonically increasing generation owns each async callback and second-factor
completion. New callback, restart and destruction invalidate that ownership.
Only current results may set tokens, pending second factors, errors or busy state.
Clear the old code on reused-route callbacks as well as destruction. This does
not cancel the API request or undo its server-side identity effects.

## Product pass
A late successful sign-in must not replace a newer rejected attempt or take the
user away from the screen they chose. Covers OIDC only, not SAML callbacks or
external provider acceptance. Existing link and second-factor semantics remain.

## Designer pass
Inspected the actual 480x800 late-response screen: newer safe error stays visible,
Back to sign-in remains available, no second-factor form or horizontal overflow.
No new visual surface or broad design claim.

## Security pass
Actual API success responses are delayed after server validation, not replaced
with fabricated tokens. Tests prove successful callbacks cannot persist tokens
or navigate after component destruction or newer callback. Pending-only stale
state is also checked directly, since ordinary fields may not trigger a render.
The server still completes already-issued requests; no cancellation claim.

## QA/integration pass
OIDC browser checks increase from 24 to 36: four late-response scenarios, each
with a successful real-response assertion and two stale-result checks. Scenarios
cover callback access token/newer callback, access token/destruction, pending
second factor/newer callback, and successful second factor/newer callback.
Old committed component fails seven assertions (RC1); fixed component passes
36 (RC0). First fixture version checked only DOM for stale pending token, which
missed an unrendered field mutation. Added direct component-state assertion,
repeated old/fixed runs, and proved that case discriminating too. These are local
browser/API/PostgreSQL/mock-issuer checks, not a real IdP acceptance run.

Final verification: all 41 integration legs pass with individual RC0; rerun in
bounded batches after two initial batch timeouts. Those interruptions killed
PostgreSQL mid-run and left socket files owned by confirmed defunct processes.
Removed only those two dead sockets, reran merge-concurrency/SAML, then reran all
legs from interrupted batches to obtain completed outer RC0 results too.
Four reaper checks RC0; API204/24 suites and web24/5 suites RC0; both builds RC0.
Broad visual242 checks, inner and outer RC0. These total46 sweep legs plus the
separate broad visual run. No parity/security completion or coverage promotion.
