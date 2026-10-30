# 0113 - Existing-account OIDC identity linking in browser

## Developer pass
Account route and Projects link start existing fresh-password OIDC link API.
Same-tab state used by existing callback. Clear password field on submit and
destroy, discard async result after destroy, clear stale state before attempt.
Scoped step-up request preserves current session on wrong-password401; generic
request helper otherwise cleared token and broke retry. Server still validates
session/password/epoch; preserving token grants nothing if session expired.

## Product pass
Explicit account identity linking, not account merge or project permission
change. Warn to confirm intended provider account, existing-linked identity
rejected. Only OIDC, no SAML link UI, unlink/list identities or SSO-only password
setup here. Real provider acceptance remains unverified. No coverage promotion.

## Designer pass
Inspected desktop1280 and narrow480 pixels: clear warning, password label and
single continue action, no overflow. Configured/unconfigured/loading/error
states. Password never echoed in completion content.

## Security pass
Existing server session/fresh-password/epoch flow reused, not client authority.
Browser keeps only opaque state in sessionStorage, no password persistence.
Wrong-password attempt clears prior state and field without revoking session.
Linked-elsewhere identity cannot be stolen; browser and database regression.
No external IdP registration, account changes or real provider communication.

## QA/integration pass
Twelve real browser/API/PostgreSQL/mock-issuer checks: Projects click-through,
narrow layout, wrong password no identity/state/field, session survives bad
step-up, successful identity binds original user without provisioning, original
project accessible, code/state scrub, no browser password persistence, conflict
rejection/preserved owner, unauthenticated route guard. First two runs timed
out on retry after generic client401 cleared session; fixed scoped client,
third run passes. This was an app bug, not just fixture timing.
