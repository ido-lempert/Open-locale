# Bound provider sign-in start feedback

## Developer
Only OIDC/SAML start catches use fixed provider-specific reload guidance instead
of arbitrary exception messages. Existing URL checks, busy/lifecycle guards,
state writes, local password/login/signup behavior unchanged. No API/server edit.

## Product
Feedback says provider sign-in could not start and recommends reloading the
sign-in page before trying again. No claim about completed authentication or
account changes, no automatic replay or new retry control. Existing same-tab
state is preserved on failure, not described as freshly validated or cleared.

## Designer
Actual desktop and390px screenshots visually inspected. OIDC fixed alert wraps
inside existing login card; provider choices, local fields and button remain
readable without horizontal overflow. Both-provider text exercised in browser;
screenshots show OIDC. No layout/style changes.

## Security
API/network exception text no longer flows into either provider-start alert.
Existing lifecycle/URL checks stay intact. No changes to token handling, storage
policy, credentials, endpoint allowlists or permissions. This slice deliberately
does not change local password/signup diagnostics or existing stored-state rules.

## QA and integration
-18 new unit cases cover both-provider Error/TypeError/null/string rejection,
  invalid/missing URL responses and late rejected starts after destruction.
  Before fix16failed/2passed; all26 login-lifecycle cases pass after fix.
- Restoring only OIDC raw-error rendering failed exactly one selected test,
  restored before staged web units136files/1795tests plus136files/1568tests,
 272unique files/3363tests green.
- New browser21/0 uses real local session/database with intercepted provider info
  and start fault responses: private503, malformed200, invalid protocol and
  transport abort. Both-provider bounded text, existing state/session preservation,
  no replay and390px overflow checked. Actual password login then succeeds.
- Existing login configuration8/0, lifecycle8/0, mock-provider OIDC49/0 and SAML61/0.
  These exercise local redirects/auth/callback behavior, not external IdP acceptance.
  No whole-product browser/native/sync rerun claim.
- Web production build compiles; API dependency valid cache. Existing initial
  bundle warning persists. Docs138routes, syntax and diff checks pass.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external acceptance gaps, disabled workers and unchosen license unchanged.
No spend, registration or token-scope expansion.
