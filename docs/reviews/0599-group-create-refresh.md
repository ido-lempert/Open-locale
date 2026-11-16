# Preserve unrelated Settings drafts after group creation

## Developer review
Replace add-group broad reload with groups-only refresh. Keep busy/name preflight,
submitted name/role/locales and unchanged clear/whole newer draft preservation.
Pending and validation units now use actual listGroups, retaining all validation
assertions. Existing name-discard503 targets groups GET. No API/schema/native change.

## Product review
Accepted group creation keeps unrelated general/rule drafts. Newer group grant
still needs explicit Add group; refresh failure keeps accurate created receipt.
A created group has no members and does not grant access by itself.

## Design review
Rules now say groups-only refresh, not broad Settings refresh. Four final-copy
pending/name-discard desktop1278x899/mobile390x844 screenshots inspected: controls
and receipts readable/fit. Pending mobile starts at name; discard mobile at Add
group, name/role/locales above viewport. No layout change.

## Security review
Disposable local groups only, original saved DB role/locales and empty membership
verified. Newer admin selection is sent only on separate explicit Add group.
Literal HTML-like name remains text. No real grant/account/membership,
credential/scope, worker, spend or license change.

## QA review
Initial unitsRC1: one existing group-validation test still expected broad reload
and lacked listGroups. Updated its refresh mock/expectation, keeping Unicode,
parsed choices and clear assertions; corrected unitsRC0 web2431/217/APIcached.
BuildRC0 webactual/APIcached. FocusFIRST12/0, deliberate broad-reload-only
negative10PASS/2FAIL RC1, restored12/0. Name-discardFIRST8/0. Design review then
clarified group rules copy; units/buildRC0 webactual/APIcached and final-copy
focus12/0/name-discard8/0. Real browser/API/PostgreSQL covers held duplicate,
original grant/no members, whole newer draft, explicit next Add, unchanged clear,
403/no refresh,503 truthful receipt, groups-only GETs and unrelated draft retention.
Full regression: API a/b/c/d, sync-preview644, automations132,2FA37,SAML55
all first RC0. Sync95+144=239 and native116+111+19=246 first RC0,
staged separately with four repeated native startup assertions. Config sync16,
native14, docs4, glossary reset3, runner4 and syntax/diff checks RC0.
219 browser suites currently2524PASS/0FAIL:218 first RC0;189 initially aborted
before assertions because fixed PostgreSQL port55962 was in use. A temporary
fixture differing only in DB port56007 passed10/0 RC0, then was deleted. Original
failure retained, tracked fixture unchanged. This is not an uninterrupted first
sweep. App and tracked fixtures unchanged throughout broad verification.
Final units/build RC0, both2/2 cached; earlier final-copy web units/build ran
actual, APIcached. Final docs4/syntax2/diffRC0. Reinspected all four browser
screenshots after regression: readable and fit; viewport limitations noted above.
All five review passes closed. No external acceptance claims changed.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
