# Preserve unrelated Settings drafts after custom-status addition

## Developer review
Use project-only refresh after accepted status-list update. Existing busy/syntax
preflight, loaded whole list, trimmed uppercase submitted candidate, exact raw
comparison, unchanged clear and newer raw draft retention stay. Pending/validation
units mock actual getProject with assertions retained. No API/schema/native change.

## Product review
Keep unrelated general/rule drafts after Add status. Invalid newer status remains
unsent until corrected and separately added. Whole loaded list replacement stays,
not a concurrency-safe append. Refresh failure does not undo accepted status save.

## Design review
Rules explain project-only refresh and kept forms. Four real pending/discard
desktop1278x899/mobile390x844 screenshots inspected: readable/fit. Pending mobile
starts at input; discard mobile at Add with input above viewport. No layout change.

## Security review
Disposable local project/statuses only. Literal HTML-like invalid newer input stays
text/unsent. Server validation/auth unchanged. No real project/access/account,
credential scope, membership, worker, spend or license change.

## QA review
Initial units/buildRC0 webactual/APIcached. FocusFIRST13/0; deliberate broad-reload
negative11PASS/2FAILRC1; restored13/0. Existing discardFIRST7/0. Real browser/API/
PostgreSQL covers held duplicate/submitted normalized candidate and loaded list,
actual saved statuses, literal invalid newer input, explicit corrected Add,
unchanged clear,403/no refresh,503 truthful saved receipt, project-only GETs and
unrelated drafts.

Final five-perspective closeout: project-only refresh and draft/receipt behavior
match the intended change; loaded whole-list replacement remains explicit, not a
concurrency-safe append. No further code fixes from final developer, product,
design, security or QA review. Final four pending/discard screenshots inspected
at 05:58 Nov17, readable with no horizontal overflow; mobile scroll caveats above.

API a/b/c/d, sync-preview644, automations132,2FA37,SAML55 all first RC0.
Sync staged95+144=239 and native staged116+111+19=246, including four startup
repeats, first RC0 in separate calls. Config sync16/native14/docs4,
glossary-reset3/runner4 and syntax/diff RC0.
Browser219 current2530PASS/0FAIL:218 first RC0; suite022 first RC1 aborted
before assertions because PG55538 was occupied (0PASS/1suite-abort). A temporary
fixture changed only its database port to56016 and passed31/0RC0; temporary
file deleted, tracked fixture unchanged, original failure retained. This is
staged current evidence, not an uninterrupted first-pass sweep.
Final API/web units and builds RC0 (2/2cached each), docs4/0, syntax1/diffRC0.
No app or tracked-fixture changes during broad regression.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
