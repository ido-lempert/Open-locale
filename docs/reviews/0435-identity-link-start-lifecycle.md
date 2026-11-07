# 0435 Identity linking start lifecycle

## Developer review
Alive/configuration-pending guard precedes password consumption, same-tab storage
clear, crypto and API. Alive recheck after async SAML digest precedes link-start
request. Existing late-response alive fence preserved. No API/schema/dependencies.

## Product review
Leaving linking screen cannot initiate a new link from captured handlers or a
late digest. Already-submitted link requests cannot be undone by leaving; existing
validated-link caveat unchanged. Normal password-confirmed OIDC/SAML flows retained.

## Design review
Actual local pending SAML screenshot inspected, password consumed/blank and
Starting disabled; provider/link-before-handoff/second-factor caveats readable.
No layout changes. Configured flag and held crypto are explicit local test doubles,
not evidence of production IdP acceptance.

## Security review
No real account/provider/credential changes. No saved attempt storage mutation
from destroyed initial handler; digest cannot submit after destroy. Existing
provider URL/state/PKCE validation unchanged. Original owner upload authority/live
target checked before push.

## QA/integration review
Unit5 both providers destroy/storage/no API, pending config, deferred digest and
late response. Browser5 local flags/held crypto with actual request observer proves
no POST or verifier write after destroy. Existing real local OIDC-link12/SAML-link55
flows0. API265/31 web769/67 builds0. All API/isolated browser regressions final0;
identities guard initial5PASS1FAIL missing confirmation DOM before typing, added
explicit selector wait then7/0, no app fix. Sync separate95/144239unique;
native116/111/19 (246total242unique/four repeats) inner/outer0. Final16/14/docs4-
138routes/reaper4 all0. No interrupted tests/canonical uninterrupted claim.
Checkpoints removed. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
