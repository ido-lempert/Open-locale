# Guard API-token revocation confirmation and pending state

## Developer review
Match confirmation to an existing token before revoke, including direct calls.
Busy state blocks start/cancel/revoke. Accepted DELETE removes target locally
before refresh, closes confirmation and clears matching reveal. Refusal keeps
list/confirmation/reveal for retry. Independent drafts and other reveals stay.
No API/schema changes.

## Product review
Revocation is irreversible, scripts using that token stop. Confirmation includes
token name and warning. Saved receipt distinguishes accepted revoke from failed
refresh and does not imply other tokens revoked. No promise to cancel pending
requests. Token management remains account-scoped, not project-scoped, as before.

## Design review
Named start/confirm/cancel controls use existing layout with disabled busy state.
1278x899 desktop and390x844 mobile confirmation and accepted-state pixels inspected:
warning/buttons/receipt fit, no overflow. Other-token name above accepted mobile
viewport,503 error below. Matching revoked reveal absent; new-name draft stays.

## Security review
Disposable local app tokens only, no real user credential/scope/account change,
worker enablement, spend, registration or license choice. Existing API session,
step-up and token ownership checks unchanged. UI guards are not authorization.
Real HTTP token authentication proves revoked token401 and other token200.

## QA review
Six new units first webactual/APIcachedRC0, first build sameRC0.
Focused first12PASSzeroFAILRC0. Negative removing ONLY matching confirmation guard
0PASS2FAILRC1 at unconfirmed direct DELETE. Restored12/0 with all assertions kept.
Actual PostgreSQL row removal and HTTP authentication,403 preserves retry/reveal,
held DELETE duplicate/cancel/other-target guards, accepted DELETE then503 refresh
retains local removal/receipt/no retry and independent drafts. Zero tasks,
translations, webhook deliveries or runtime errors.
APIa/b/c/d and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync95+144=239 firstRC0. Native first116/0, middle initially RC1 after8PASS,
zero FAIL assertion lines: timeout waiting for revoke confirmation. Exact failed
click state not captured, cause unproved. Existing fixture clicked on row presence,
without waiting for creation refresh/busy state; readiness-only wait added for
not-busy and enabled Revoke. Assertions unchanged. Source-bound checkpoint removed
by existing failed cleanup; corrected first116/middle111/tail19=246 allRC0 in
separate calls. No app fix. Logs preserved, not an all-first-pass native claim.
Config16/14/docs4/glossary harness3RC0. Initial runner invocation used nonexistent
run-reaped-test.py and did not run; corrected reaped-runner-test.py4RC0.
Browser001..208 all FIRST2360PASSzeroFAILRC0, each suite own call, preserved
across run boundaries, not an uninterrupted run. Final units/build web/API cached
RC0; docs4/script syntax/diff checksRC0. Latest four confirmation/accepted desktop
and mobile pixels inspected again after208; warning/buttons/receipt fit as above.
Coverage22FULL/7PARTIAL/1MISSING and defaultOFF unchanged.
