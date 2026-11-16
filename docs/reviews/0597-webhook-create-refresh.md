# Preserve unrelated Settings drafts after webhook creation

## Developer review
Replace broad Settings reload with webhooks-only refresh. Retain busy guard,
submitted URL/events snapshot, unchanged URL clear and whole newer draft
preservation. Units now hold/fail actual listWebhooks; URL-discard503 fixture
intercepts the webhook list instead of project GET. No API/schema/native change.

## Product review
Successful Create keeps unrelated general/rule drafts. The signing-secret reveal
belongs to the submitted webhook, not a newer uncreated URL/event selection.
Refresh failure preserves truthful created receipt/reveal without claiming a
refreshed list or failed creation. Newer draft needs separate explicit Create.

## Design review
Four pending-draft/URL-discard desktop1278x899/mobile390x844 screenshots inspected:
controls/receipts fit and are readable, fixture secret bytes masked in DOM only.
Pending mobile starts at URL; discard mobile starts at Create with URL/events and
reveal above viewport. No layout change.

## Security review
Disposable local database only, hosts stored without event-triggering writes.
Submitted URL/events, saved DB selection and secret-ID binding checked. Newer
selection sent only on explicit second Create. No deliveries queued or attempted.
No external receiver, account, credential/scope, worker, spend or license changes.

## QA review
Initial units/buildRC0 webactual/APIcached, web2431 tests/217 suites. FocusFIRST13/0;
deliberate broad-reload-only negative11PASS/2FAIL RC1; restored13/0. URL-discard
FIRST8/0. Actual browser/API/PostgreSQL held duplicate, newer URL/events, saved DB
webhook/secret ID, unchanged clearing, no-events no-send,403/no refresh,503 truthful
receipt/newer draft, only webhooks GETs and unrelated general/rule draft retention.
Full regression: API batches a/b/c/d plus sync-preview644/automations132/2FA37/
SAML55 all FIRST RC0. Sync stages95+144=239 and native116+111+19=246 with four
startup repeats all FIRST RC0. Config sync16/native14/docs4/glossary reset3/runner4
passed. An initial runner command used an absent filename; corrected existing
runner test passed4/0 with no code change. All219 browser suites FIRST2519/0,
app and fixture source unchanged throughout the sweep. Final units/buildRC0 both
two-project cache hits; final docs4, changed-browser-script syntax2 and diff RC0.
Four latest desktop/mobile screenshots inspected again after full sweep: controls
and receipts readable/fit, fixture secret bytes masked; viewport caveats above.
Five perspectives checked against final diff, no unresolved review finding.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
