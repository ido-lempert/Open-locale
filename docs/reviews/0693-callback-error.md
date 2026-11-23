# Bound callback redemption errors

## Developer
Module-private CallbackValidationError identifies only locally constructed
validation messages. Other callback exceptions render fixed cautious feedback.
Both OIDC/SAML retain URL scrubbing, consumed state/verifier, generation fences,
second-factor and successful navigation behavior. No API/server changes.

## Product
Initial blanket catch replacement removed useful local validation guidance;
review caught this and narrowed behavior before commit. Missing/unsolicited
callback and provider cancellation/rejection keep their existing specific safe
messages. Unknown redemption faults suggest restart and checking linked identities
after sign-in without implying a validated link was undone. No automatic replay.

## Designer
Actual desktop and390px screenshots visually inspected. Fixed alert wraps inside
auth card, Back to sign-in stays visible/readable, no horizontal overflow. These
show OIDC unknown fault; same callback template behavior is tested for SAML.

## Security
Only private locally constructed error instances can select specific text.
Arbitrary Error/TypeError/string/null API/network failures cannot expose raw
issuer/XML/provider messages. Known SAML error marker selects fixed text, never
its content. No allowlist, token, endpoint, credential or auth-policy changes.

## QA and integration
-22 new unit cases cover both-provider rejected errors and malformed responses,
  factor handoff, late destruction, missing state and known provider error text.
  Final first stage136files/1777tests and unchanged second136files/1568tests:
 272unique web files/3345tests green.
- Reintroducing raw Error rendering into final OIDC branch failed exactly one
  targeted test; restored before final unit run.
- New browser24/0 with local session/database and intercepted private503,
  malformed200, transport failures and factor success. Both-provider URL/state
  cleanup, no replay/session install, explicit restart and390px overflow checked.
- First fault run failed6 SAML assertions due to same-route fixture reuse. Explicit
  login navigation between independent scenarios fixed it; final24/0.
- Existing mock-provider browser OIDC49/0 and SAML61/0, plus callback handlers9/0.
  Initial overbroad UI change failed expected local-message checks and timed out;
  narrowed private validation branch restored existing suites without changing
  their expected messages. Covers actual local redirects/recovery/sign-in, replay,
  stale callbacks, bounded stores and SAML link behavior. No external IdP acceptance
  or whole-product/native/sync rerun claim.
- Final web build compiled, API dependency valid cache. Existing initial bundle
  warning persists. Docs138routes, syntax/diff checks pass.

Five review passes completed with product-guidance and fixture fixes before
commit. Coverage22 FULL/7 PARTIAL/1 MISSING, external acceptance gaps, disabled
workers and unchosen license unchanged. No spend, registration or scope expansion.
