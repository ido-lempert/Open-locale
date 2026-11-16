# Preserve unrelated Settings drafts after membership save

## Developer review
Replace add-member broad reload with members-only refresh. Retain busy guard,
submitted email/role/locales snapshot, unchanged email/locales clear and whole
newer-draft preservation. Units hold/fail actual listMembers. Existing email-
discard503 fixture now targets members GET. No API/schema/native change.

## Product review
Adding or upserting membership keeps unrelated general/rule drafts. Saved
membership receipt remains accurate when a newer unsent grant is present or the
list refresh fails. No automatic second save of newer email/role/locales.

## Design review
Four pending/email-discard desktop1278x899/mobile390x844 screenshots inspected:
controls and receipts readable and fit. Pending mobile starts at email; discard
mobile starts at Add with email/role/locales above viewport. No layout change.

## Security review
Only disposable local demo users/memberships. Real POST snapshot and saved DB
role/locale grants verified. Newer admin grant sent only on separate explicit Add.
Existing membership upsert receipt says saved, not newly created. No real account,
membership, credentials/scope, worker, spend or license change.

## QA review
Initial units/buildRC0 webactual/APIcached, web2431 tests/217 suites. FocusFIRST14/0;
deliberate broad-reload-only negative11PASS/3FAIL RC1; restored14/0. Email-discard
FIRST9/0. Actual browser/API/PostgreSQL: held duplicate, exact submitted grant,
whole newer draft, explicit next Add, unchanged clearing,403/no refresh,503 truthful
saved receipt, real upsert and only members GETs/unrelated draft retention.
Full regression: API batches a/b/c/d plus sync-preview644/automations132/2FA37/
SAML55 all FIRST RC0. Sync stages95+144=239 and native116+111+19=246 with four
startup repeats all FIRST RC0. Config sync16/native14/docs4/glossary reset3/runner4
passed. All219 browser suites FIRST2522/0, app and fixture source unchanged
throughout sweep. Final units/buildRC0 both two-project cache hits; docs4,
changed-browser-script syntax2 and diff RC0. Four latest desktop/mobile screenshots
inspected again after full sweep: controls/receipts readable and fit, viewport
caveats above. Five perspectives checked against final diff with no unresolved
finding. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
