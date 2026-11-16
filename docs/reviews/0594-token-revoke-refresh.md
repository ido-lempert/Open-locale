# Preserve Settings drafts after API-token revocation

## Developer review
Replace full Settings reload with tokens-only list refresh after accepted local
removal, confirmation cleanup, receipt and matching display cleanup. No API/schema
change. Existing target/confirmation/busy guards retained.

## Product review
Revocation remains irreversible; this fixes lost unrelated drafts on successful
refresh, not token recovery. Accepted removal remains visible on refresh failure.
Other tokens and scopes are unchanged by each submitted revoke.

## Design review
Four confirmation/accepted desktop1278x899 and mobile390x844 pixels inspected.
Controls, confirmation scope, receipt and retained token-name draft are readable
and fit. Receipt mobile viewport begins below surviving token row. No layout change.

## Security review
Disposable local tokens and test account only. Actual X-Api-Key requests verify
revoked token401 and other token200, then explicit other revoke401. No external
account, persistent credential, worker, scope, spend or license change. Matching
one-time display cleared; nonmatching synthetic display preserved. No token bytes
in screenshots or logs. No tasks/translations/deliveries created.

## QA review
Initial web units2431/217 suites RC0 (Nx testFile flag did not narrow execution).
BuildRC0 webactual/APIcached. FocusFIRST15/0; deliberate broad-reload-only
negative11PASS/4FAIL RC1; restored15/0. Actual local browser/API/PostgreSQL covers
confirmation/mismatch/cancel/403/heldduplicate/other-target, accepted removal503,
no stale replay, matching reveal cleanup, tokens-only GETs on both503/success,
retained general/token/rule drafts and nonmatching display on successful refresh.
All219 browser suites current2512PASS/0FAIL;218 first-attempt successes.
114 key-delete-recovery first0PASS/1FAIL aborted at startup PostgreSQL55774 bind;
loopback TIME_WAIT to API3000 without listener, seven3-second bind waits, unchanged
second8/0. No source changes during broad sweep, not an all-first claim.
APIa/b/c/d plus sync-preview644/automations132/2FA37/SAML55 firstRC0.
Staged sync95+144=239/native116+111+19=246 firstRC0, four native startup repeats.
Config sync16/native14/docs4/glossary-reset3/runner4 and syntax/diffRC0.
Final unitsRC0 webactual2431/217suites/APIcached; buildRC0 bothcached. Five
perspectives closed with no new implementation defect found in broad regression. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
