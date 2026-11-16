# Preserve unrelated Settings drafts after API-token creation

## Developer review
Replace full Settings reload with tokens-only refresh. Existing busy guard,
submitted name/scopes snapshot, unchanged-name clearing and whole newer-draft
preservation retained. Pending units now hold/fail the actual listTokens call.
Existing name-discard browser503 fixture targets tokens instead of project GET.
No API/schema/native-fixture change.

## Product review
Successful Create no longer overwrites unrelated general/rule drafts. One-time
reveal remains the submitted token, not a newer uncreated name/access draft.
Refresh failure keeps reveal, but does not invent a refreshed token list or claim
creation failed. A new token still needs explicit Create with reviewed access.

## Design review
Four pending-draft/name-discard desktop1278x899/mobile390x844 pixels inspected:
controls and receipts readable and fit. Pending mobile viewport starts at name;
name-discard mobile starts at access, with name/reveal above viewport. Fixture
bytes masked in screenshot DOM only. No layout change.

## Security review
Disposable demo account/tokens only; raw name/scopes checked at POST boundary,
read-only saved scope and reveal-ID binding verified. Newer write access sent only
on separate explicit Create. All fixture tokens revoked before teardown. No raw
token bytes in screenshots/logs. No external account/credential/scope expansion,
worker/spend/license change.

## QA review
Initial units/buildRC0 webactual/APIcached, web2431/217 suites. FocusFIRST12/0;
broad-reload-only deliberate negative10PASS/2FAIL RC1; restored12/0. Name-discard
fixture FIRST8/0. Actual local browser/API/PostgreSQL held duplicate, scope-only
newer whole draft, submitted read-only DB token/reveal ID, success tokens-only GET
and retained general/rule drafts, explicit second create, unchanged clearing,
403/no refresh,503 accurate reveal/receipt/newer draft, all GET paths tokens-only.
Full regression: API batches a/b/c/d, sync-preview644, automations132,2FA37,
SAML55 all FIRST RC0. Sync stages95+144=239, native116+111+19=246
with four startup repeats, all FIRST RC0. Config sync16/native14/docs4,
glossary reset3/runner4 and syntax/diff passed.
All219 browser suites current 2517PASS/0FAIL. 218 suites FIRST RC0. Suite045
reports-download initially1PASS/1FAIL RC1: actual downloaded bytes passed, then
notice assertion raced Angular rendering after anchor click. Added fixture-only
waitForSelector for branchDownloadNotice before its existing assertion; corrected
6/0. App source unchanged throughout sweep. The fixture wait was added after
001-044; preceding API/sync/native results cover the same app source. No completed
stage was restarted or represented as an uninterrupted canonical run.
Final units/buildRC0 both two-project cache hits. Final docs4, all three changed browser-script syntax checks and diff check RC0.
Final four desktop/mobile screenshots inspected again after the full sweep:
controls/receipts readable and fit; fixture bytes masked. Mobile name-discard
viewport begins at access, name/reveal above it. Five review perspectives checked
against final diff. Publication closeout remains. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
