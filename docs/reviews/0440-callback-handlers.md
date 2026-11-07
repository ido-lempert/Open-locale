# 0440 Callback handler readiness

## Developer review
Explicit destroyed guards added to OIDC/SAML consumer, completion and restart.
Restart now matches its disabled busy control. Whitespace-only second factor
returns before consuming the one-use pending token or making a request. Existing
generation fences/route subscriptions retained. No API/schema changes.

## Product review
Accidental blank factor cannot spend a pending sign-in. A captured Back handler
cannot abandon an in-flight verification contrary to its disabled state. Idle
Back still clears factor and returns to login. Leaving by other navigation does
not cancel or undo already-submitted requests. Normal valid sign-ins retained.

## Design review
Actual local pending completion pixels inspected: clear Checking status, disabled
Back, no stale factor form after token consumption. No layout changes. Fixture
pending token/held completion response is not real provider acceptance evidence.

## Security review
Destroyed captured completion cannot submit a restored stale token; destroyed
consumer cannot touch same-tab handoff state. Late completion cannot write session
or navigate. Existing server single-use/state/PKCE/factor validation unchanged.
Only disposable local account/socket fixtures; no real provider/account changes.
Original owner upload authority and live named target verified before commit.

## QA/integration review
Ten new units (five per provider), web798/70 API265/31 builds0. Browser9 actual
observed held completion sockets for both providers: blank no request/token kept,
valid one request/no busy restart, late destroyed result preserves session/route,
idle Back works. Initial0PASS1FAIL timed out waiting for form because injected
plain pendingToken did not schedule rendering; clearing existing error signal
fixed fixture then9/0, no app fix. Normal local OIDC49/SAML61/link12/55 and all
API/isolated browsers final0. Sync separate95/144239unique; native separate
116/111/19=246total242unique/four repeated checks inner/outer0. Final configs16/14/
docs4-138routes/reaper4 all0, checkpoints removed. Continued across run boundary
without interrupted tests or restarting completed checks. No canonical
uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
