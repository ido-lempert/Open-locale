# 0117 - Existing-account SAML linking in browser

## Developer pass
Shared identity-link page selects provider from explicit route data. SAML uses
fresh-password browser/start-link, random same-tab verifier and SHA256 challenge.
OIDC state handling remains separate. Password cleared on submit/destroy; async
results ignored after destruction. Scoped step-up requests preserve a valid
session on wrong-password401, while server still validates session and epoch.

## Product pass
Separate Projects links label OIDC and SAML. Copy states that linking happens at
validated provider response, before browser handoff/second-factor completion;
closing or failing the callback does not undo it. No merge, permission change,
unlink/list identities or SSO-only password setup. Local mock acceptance only.

## Designer pass
Inspected1280x850 and480x850 page pixels: readable warnings about provider choice
and link timing, labeled password and one continue action, no overflow. Loading,
unconfigured and error states retained. Existing callback second-factor surface
reused. No password or verifier in screenshot.

## Security pass
Only composed fresh-auth endpoint used, not ordinary SAML start-link redirect.
Verifier is saved in sessionStorage only after valid authorization URL; stale
attempt removed even on failed password. Password never persisted. Existing
server signature/request/epoch controls and verifier handoff retained. Linking
can finish before callback redemption, explicitly explained rather than hidden.

## QA/integration pass
Sixteen real browser/API/PostgreSQL/signed-mock-issuer checks include Projects
click-through, wrong password/state cleanup and session retention, existing
identity binding without provisioning, original project access, scrubbed handoff,
no password persistence, original-account second-factor pause and successful
recovery completion, consumed recovery code, conflict/preserved owner, route
guard. Registered new suite in package scripts/full sweep. No external IdP.

Final verification:47 unique sweep legs (new SAML-link-browser leg) all
individualRC0,42 integrations in eight fail-closed batches all outerRC0. API205
in24 suites, web24 in5 suites, both builds and reaper4 RC0. Broad visual through
temporary database/browser checkpoint split:116+128=244 PASS with two repeated
startup checks,242 unique, every source assertion label covered. Both stages
inner and outerRC0. This is staged verification, not one uninterrupted run.
Temporary runner/checkpoint removed. Existing OIDC link12/browser36 and SAML
browser57 checks pass with shared-page changes. No failures in this slice.
