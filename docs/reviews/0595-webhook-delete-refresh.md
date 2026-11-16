# Preserve Settings drafts after webhook deletion

## Developer review
Replace full Settings reload with webhooks-only refresh after accepted local
removal, confirmation cleanup, receipt and matching display cleanup. Existing
confirmation/target/busy guards retained; no API/schema change.

## Product review
Deletion remains irreversible and cascades delivery history. This preserves
unrelated drafts on successful refresh, not webhook recovery. Accepted local
removal and receipt remain on refresh failure without stale replay.

## Design review
Four confirmation/accepted desktop1278x899/mobile390x844 pixels inspected.
Confirmation controls, receipt and retained URL draft readable and fit. Accepted
mobile viewport begins below surviving webhook URL. No layout change.

## Security review
Disposable local webhook rows only. History rows seeded in PostgreSQL, no delivery
sent. Selected history cascades while sibling history remains until its own explicit
delete. Matching secret display cleared; nonmatching synthetic display preserved.
No secret bytes in screenshots/logs. No external request/account/credential/worker/
spend/scope/license change; no tasks/translations/emitted deliveries.

## QA review
Initial units/buildRC0 webactual/APIcached; web2431/217 suites. FocusFIRST13/0,
broad-reload-only negative9PASS/4FAIL RC1, restored13/0. Actual local browser/API/
PostgreSQL confirmation/mismatch/cancel/403/held duplicate/cancel-other blocking,
accepted deletion503/no stale replay/matching secret cleanup, webhooks-only GETs
on503/success, retained general/URL/events/rule drafts and nonmatching display,
exact seeded history cascades across two explicit deletes. All219 browser suites first-attempt RC0, 2515PASS/0FAIL. No source changes
during broad sweep. APIa/b/c/d plus sync-preview644/automations132/2FA37/SAML55
firstRC0. Staged sync95+144=239/native116+111+19=246 firstRC0, four native startup
repeats. Config sync16/native14/docs4/glossary-reset3/runner4 and syntax/diffRC0.
Final units/build bothRC0, both Nx projects cached. Five perspectives closed;
no new implementation defect found in broad regression.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF and external gaps unchanged.
