# 0510 Saved-text search help disclosure

## Developer review
Native details/summary wraps the existing full scope paragraph unchanged. A short
visible scope remains above it. No new component state, events, requests or query
logic. Opening and closing leaves loaded results and filters alone. No custom
keyboard handler that could conflict with native behavior.

## Product review
The search action now fits the initial390px viewport rather than following a long
rules paragraph. Full literal-match, source/status/tag/description rules remain
available on demand. Read-only/base-value/local-draft/plural exclusions stay
visible even when collapsed. This is layout support, not expanded search scope.

## Design review
Actual desktop and390px pixels inspected. Native triangle and clear summary text
identify the disclosure. Keyboard focus outline is visible; labels and controls
wrap with no horizontal overflow. Initial mobile view includes the Search action.
Opening help intentionally lengthens the page and can require scrolling. Native
keyboard behavior checked, not screen-reader acceptance certification.

## Security review
No private state added to disclosure, no HTML injection, uploads, writes, new
requests, credentials, worker changes, spend or license change. Existing complete
scope text remains accessible, while concise exclusions remain visible. Toggle
has no action authority and does not requery or change loaded data.

## QA/integration review
Focused browser first10/0/restored10/0, no fixture/app fixes. Intentional old-app
0PASS then missing-help-element abort retained. Actual Enter and Space toggle
native disclosure; summary focus retained on close, no requests/writes on toggles,
real PostgreSQL saved-value search still succeeds with oneGET and zero writes,
loaded result survives toggles. Initial390px action within viewport; no overflow
or runtime errors. No new TS logic/unit tests; fullweb1394/137,API265/31cached,
builds0bothcached after initialwebbuild0. APIa/b/c/dpreview6442fa37SAML55 first0; automations132/0RC0firstactual
using12 unchanged-source bundles prepared separately and a temporary harness
skipping only bundling with existencechecks, all assertions/sleeps/DB unchanged,
fresh55829cleaned. Separate sync95+144239unique eachfirstinnerouter0. Separate native116+111+19=246total/242unique with4 startup repeats,
eachfirstinnerouter0. Config16/14/docs4-138routes/reaper4 all0. All137 isolated browser suites first-attempt RC0,1486 passing assertions,
no failed assertions or source changes. README/PLAN updated; final docs check
passed4/0 before commit/push. Checks preserved through routine pauses, staged not
uninterrupted. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
