# Bound linked-identity unlink errors

## Developer
The component no longer renders arbitrary exception messages from unlink.
All rejected or malformed-result paths use one fixed cautious message. Existing
password clearing, selected binding, generation guard and successful sign-out
behavior remain unchanged. No API/client contract or endpoint behavior changes.

## Product
An exception does not prove whether a write happened. Feedback says the result
could not be confirmed, recommends signing in before another unlink and notes
that the typed password was cleared. It does not claim a binding was retained,
deleted or safe to replay. No automatic retry or added retry control. Wrong
password detail is deliberately less specific to keep this boundary narrow.

## Designer
Visually inspected actual desktop and390px screenshots after private-error
response. Fixed alert wraps inside confirmation card, no raw payload or image
markup, input visibly empty. Existing password/session caveats and buttons remain
usable. No horizontal overflow; mobile is a scrolled view of confirmation.

## Security
Arbitrary API/network exception content no longer crosses into unlink feedback.
The current password clears before request; existing current-read, busy and
lifecycle fences remain. No credential logging, account policy, permissions,
external provider or session/token changes added. Fault cases preserve local
session state rather than declaring verified server state.

## QA and integration
- Ten new unit cases: Error/TypeError/string/null rejections, four malformed
  acknowledgements, late failure after destruction and read-only refresh cleanup.
  Pre-fix9 failed/1passed; after fix all28 identity unit cases pass.
- Restoring only raw Error.message rendering failed exactly one selected test,
  then restored. Staged web units136files/1736tests plus136files/1568tests,
 272unique files/3304tests passed.
- New actual-browser path10/0: real wrong-password API denial and real valid
  unlink/sign-out with database binding checks; deliberately intercepted503
  private detail, malformed200 and aborted transport. Password clearing, bounded
  feedback, no automatic retry, explicit refresh and390px overflow checked.
- First browser attempt exposed test wait races, not counted green. Request-count
  and settled-component-state waits fixed it; final full rerun10/0 clean.
- Existing identity guards7, refresh7 and time6 browser assertions pass. Time test
  uses existing alternate port override. No whole-product/SSO-provider acceptance
  claim; all provider identities are local fixtures.
- Production web build compiles successfully; API dependency uses valid cache.
  Initial bundle warning remains505.13kB against500kB warning budget. Docs checks
 138routes, script syntax and diff checks pass.

Five review passes complete with test-race fixes before commit. Standing coverage
22 FULL/7 PARTIAL/1 MISSING, external acceptance gaps, disabled workers and unchosen
license unchanged. No spend, registration or token-scope expansion.
