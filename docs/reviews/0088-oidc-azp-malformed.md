# Review 0088 - OIDC azp enforcement and malformed-token handling (slice 23)

## Why
Security-pass audit of the SSO/SAML PARTIAL against the OIDC Core spec found
two real gaps in id_token validation:

1. Missing azp rule (OIDC Core 3.1.3.7): a multi-valued aud requires an azp
   claim naming the client. Without it, a token issued FOR a different party
   that merely lists our client_id among several audiences was accepted -
   the exact confused-deputy shape aud/azp exists to prevent.
2. Unhandled JSON.parse on the id_token header/payload: a malformed token
   crashed verification with an unhandled 500 instead of a clean 401.

## What changed
- verifyIdToken: header and payload parsing are wrapped - unparseable input
  is a 401 Malformed id_token, never a 500.
- After the aud check: aud.length > 1 requires claims.azp === our client_id.
- Mock issuer gains a fixture-only rawIdToken passthrough so the malformed
  case can be driven end-to-end through the real token endpoint.
- No behavioral change for single-audience tokens (azp optional per spec).

## Five passes
- Developer: parse-then-verify order preserved (claims are PARSED before the
  signature check only in code order; they are never USED before it) -
  verification still precedes every claim comparison. Build RC=0.
- PM: closer spec compliance on the SSO bullet; SSO/SAML stays PARTIAL
  (external IdP acceptance; SAML protocol itself remains unimplemented and
  is not claimed).
- Designer: no UI surface touched.
- Security: this IS the security pass - closes a confused-deputy acceptance
  and a malformed-input 500. Fail-closed posture unchanged everywhere else.
- QA: +4 legs driven through the full authorization-code flow against the
  local mock: multi-aud without azp rejected, multi-aud with foreign azp
  rejected, multi-aud with our azp ACCEPTED (control - proves the rule is
  specific, not a blanket multi-aud ban), malformed 3-part token rejected as
  401. oidc suite 50 PASS / 0 FAIL / RC=0 (was 46).

## Boundaries
- SSO/SAML stays PARTIAL: external IdP acceptance is user-owned; SAML is a
  separate protocol this slice does not claim. Mock-issuer work is local
  hardening only.
