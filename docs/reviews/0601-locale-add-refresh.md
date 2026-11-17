# Preserve unrelated Settings drafts after locale addition

## Developer review
Limit accepted locale-add refresh to project data. Busy/syntax preflight,
submitted trimmed code, exact raw draft comparison, unchanged clear and newer
raw draft retention remain. Pending/validation units mock actual getProject,
keeping prior assertions. No API/schema/native change.

## Product review
Keep unrelated general/rule drafts after Add locale. Invalid newer code remains
unsent and must be corrected before separate explicit Add. Refresh failure does
not undo an accepted locale. This does not check a language registry or permission.

## Design review
Locale rules explain project-only refresh and preserved other forms. Four real
pending/discard desktop1278x899/mobile390x844 screenshots inspected: readable,
fit. Pending mobile starts at input; discard mobile at Add, input above viewport.
No layout change.

## Security review
Disposable local project/locales only. Literal HTML-like invalid newer input stays
text/unsent. Server validation/auth unchanged. No real project/access/account,
credential scope, worker, spend or license change.

## QA review
Initial units/build RC0 webactual/APIcached. FocusFIRST13/0; deliberate
broad-reload-only negative11PASS/2FAILRC1; restored13/0. Existing discardFIRST7/0.
Real browser/API/PostgreSQL covers held duplicate/submitted trim, actual saved
locales, literal invalid newer code, explicit corrected Add, unchanged clear,
403/no refresh,503 accurate added receipt, project-only GETs and unrelated drafts.
Broad API a/b/c/d,sync-preview644,automations132,2FA37,SAML55 firstRC0.
Sync95+144=239 and native116+111+19=246 firstRC0, each stage separately,
four native startup repeats. Configsync16/native14/docs4/glossaryreset3/runner4,
syntax1/diffRC0. Browser219 current2528PASS/0FAIL:218 firstRC0;012 initially
aborted before assertions on PostgreSQL55696 bind. Temporary fixture with only
DBport56013 passed7/0RC0, deleted, tracked fixture unchanged. Original failure
retained. Not an uninterrupted first sweep. No app/tracked fixture change during
broad sweep. Final units/build2/2cachedRC0; initial web units/build actual,
APIcached. Final docs4/syntax1/diffRC0. Four screenshots reinspected after broad:
readable/fit with mobile viewport limits above. All five review passes closed.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF/external acceptance unchanged.
