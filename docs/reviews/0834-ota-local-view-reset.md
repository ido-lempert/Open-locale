# Retained OTA bundle local view reset

## Developer
Synchronous destroyed-guarded reset clears query/value filter/page only.
Control outside bundle conditional remains available when hidden local filters
survive loading/error. Four unit cases preserve scope, object identity,
feedback/status and reject departed callback. Existing individual clear kept.

## Product
Reset returns first loaded page, not refresh/publication/newer editor values.
Explicit scope says retained values and full raw download unchanged. Enabled
for page-only state as well as filters, including whitespace query.

## Designer
Actual1280x900 and390x844 pixels inspected. Reset sits between raw download
scope and loaded bundle controls, explanation readable on both widths. Mobile
scope wraps without document overflow; normal first-page controls remain
below fold, no layout overlap or misleading delivery confirmation.

## Security
No new reads/writes or private-content disclosure path. Existing raw download
still retains all values regardless of local view. No worker/provider/license/
spend/share/credential-scope change.

## QA/integration
OTA6 suites53 tests, value-filter browser14/0 first-attempt green. Browser
resets combined query/filter preserving exact loaded identities/notice/scope,
page-only reset returns first50, no requests. Removing filter reset fails3
ready/loading/error tests with1pass; restored6/53 green. Web build1/2 cache,
docs4checks138routes, syntax/diff pass. No full-web/all-backend/native/sync/
provider acceptance claim. Latest OTA checkpoint767six browser flows74 checks,
backend46; coverage22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five perspectives complete before commit, no scoped findings remain.
