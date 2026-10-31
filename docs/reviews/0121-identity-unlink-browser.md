# 0121 - Explicit-confirmation identity unlink browser flow

## Developer pass
Choose one row, password-confirmed submit, cancel clears field, submit clears
password before await. Busy prevents duplicate actions; generation ignores stale
results after destroy/reload. Scoped401 handling preserves still-valid session
on wrong password. Success clears token/list and replaces route with sign-in and
plain notice. Server transaction/epoch behavior unchanged.

## Product pass
Copy states sessions/pending second factors revoked, API tokens not revoked,
provider account/projects not deleted; local password required, no setup here.
Final action explicitly says Unlink and sign out. No external provider action,
SSO-only support or coverage promotion. Account list no longer labeled read-only.

## Designer pass
Inspected1280x850/480x850 error-confirmation pixels: selected identity visible,
warning, password, final action and cancel readable, no overflow, cleared field.
Long metadata/empty/error list regressions retained. Sign-in notice after success.

## Security pass
No direct one-click destructive call. Uses existing session/factor/fresh-password
API. Password never persisted and clears on submit/cancel/destroy. No automatic
new token. Wrong password does not accidentally sign out. No local bypass of
server restrictions; no changes to provider signatures or identity policy.

## QA/integration pass
SAML-link/identity suite48->55 checks. Added confirmation text, cancellation
without mutation, wrong-password field clear/session retention/binding unchanged,
narrow fit, successful sign-out/notice and deletion, no password persistence.
First two runs failed fixture timing after choose/cancel; added DOM render waits,
no app change for those failures. Third run55 PASS/RC0.

Final48 unique sweep legs all individualRC0;43 integration/config legs in eight
completed fail-closed batches all outerRC0. API205/24 suites, web24/5, both builds
and reaper4 RC0. Native staged visual116+128 PASS=244 checks/two repeated startups/
242 unique; every source assertion label covered, both stages inner/outerRC0.
Checkpoint removed. Staged, not uninterrupted, verification. Focused final55
checks pass, including previously established API unlink/epoch isolation checks.
