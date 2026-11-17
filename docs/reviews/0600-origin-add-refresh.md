# Preserve unrelated Settings drafts after embed-origin addition

## Developer review
Use project-only refresh after accepted allowlist update. Existing busy/syntax
preflight, submitted raw candidate snapshot, trimmed outgoing candidate, loaded
whole-array replacement, unchanged clear and newer raw draft retention stay.
Pending and validation units now mock actual getProject with assertions retained.
No API/schema/native change.

## Product review
Keep unrelated general/rule drafts after Add origin. Newer origin still needs
explicit Add and correction if invalid. The whole loaded allowlist is replaced,
not a concurrency-safe append. Refresh failure does not undo an accepted save.

## Design review
Rules explain project-only refresh and kept forms, without asserting origin
ownership/trust. Four desktop1278x899/mobile390x844 pending/discard screenshots
inspected: readable and fit. Pending mobile starts at origin; discard mobile at
Add with the field above viewport. No layout change.

## Security review
Disposable local project with .example origins only; no external origin request,
real grant/account/membership or credential change. Canonical-origin validation
unchanged; invalid HTML-like newer input stays literal and unsent. This does not
verify ownership, safety or permission. No worker, spend or license change.

## QA review
Initial units/buildRC0 webactual/APIcached. FocusFIRST13/0; deliberate
broad-reload-only negative11PASS/2FAILRC1; restored13/0. Origin-discardFIRST7/0.
Real browser/API/PostgreSQL covers held duplicate, original loaded array/trim,
literal invalid newer input, explicit corrected Add, unchanged clear,403 no
refresh,503 saved receipt, project-only GETs and unrelated drafts.
Broad actual API a/b/c/d, sync-preview644,automations132,2FA37,SAML55 first RC0.
Three mistyped npm labels and two nonexistent glossary harness filenames executed
no assertions; correct existing scripts passed, completed results preserved.
Sync95+144=239 and native116+111+19=246 first RC0, each stage separately;
four native startup repeats. Config sync16/native14/docs4/glossaryreset3/runner4,
script syntax and diff RC0.
219 browser suites current2526PASS/0FAIL:218 first RC0;097 initially aborted
before assertions because PostgreSQL port55740 was occupied. Temporary fixture
with only DB port56010 passed12/0 RC0, then deleted. Tracked fixture unchanged,
original failure retained. Not an uninterrupted first sweep. No app or tracked
fixture changes during broad verification. Routine restarts retained completed
results. Final units/build both2/2cached RC0; initial web units/build were actual,
APIcached. Final docs4/syntax1/diffRC0. Four final screenshots inspected after
regression: readable/fit with mobile viewport limitations stated above.
All five review passes closed; external acceptance claims unchanged.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
