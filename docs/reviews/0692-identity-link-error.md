# Bound identity-link handoff feedback

## Developer
OIDC/SAML start catch no longer renders arbitrary exception text. Fixed feedback
covers rejected API calls, invalid URL responses and browser handoff exceptions.
Existing password clearing, same-tab state cleanup, URL checks and lifecycle
fences remain unchanged. Configuration read failure stays separately retryable.

## Product
Message says handoff could not complete, notes cleared password and recommends
checking linked identities before starting again. It does not assert an identity
was linked, not linked or undone. No automatic replay, new retry control or
change to provider callback semantics. Provider acceptance remains unverified.

## Designer
Visually inspected actual desktop and390px browser screenshots. Alert wraps below
the form, cleared password field and provider button stay usable. Existing link
side-effect caveats remain above it. No horizontal overflow. Screenshot is OIDC;
the same template/catch is also exercised for SAML by browser checks.

## Security
Raw API/network exception content cannot leak into handoff alert. Existing
password clearing and failed same-tab state deletion preserved. No added logging,
permissions, credential scope, endpoints, external requests or session changes.
Invalid handoff URLs still cannot navigate. This does not broaden URL allowlists.

## QA and integration
-19 new unit cases cover both-provider Error/TypeError/string/null rejection,
  malformed results and URL protocols, late failure after destruction, OIDC
  missing/duplicate state. Pre-fix17failed/2passed; all28 identity-link cases pass.
- Restoring only raw-error rendering failed exactly one selected test, restored
  before staged web units136files/1755tests plus136files/1568tests,
 272unique files/3323tests green.
- New browser21/0 uses local real session/database with explicitly intercepted
  configured-provider/start responses. Both OIDC/SAML private503, malformed200,
  invalid protocol and aborted transport show fixed feedback, clear password and
  state, do not replay or create fixture identities.390px overflow checked.
  Not an external-provider or all-unmocked API acceptance claim.
- First browser run used wrong start-path matcher and failed10 assertions; fixed
  to actual /start-link, then21/0. Review found the same stale matcher in older
  configuration suite, corrected and reran11/0. Existing lifecycle suite5/0.
- Production web build compiles with API dependency valid cache. Existing initial
  bundle warning remains505.13kB vs500kB warning budget. Syntax, docs138routes and
  diff checks pass. No whole-product browser/native/sync rerun claimed.

Five review passes completed with test matcher fixes before commit. Standing
22 FULL/7 PARTIAL/1 MISSING coverage, external acceptance gaps, disabled workers
and unchosen license unchanged. No spend, registration or token-scope expansion.
