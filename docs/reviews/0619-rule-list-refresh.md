# Explicit read-only automation-rule metadata Refresh

## Developer review
GET rules only. Keeps every new-rule field/choice, earlier create/toggle/remove
receipts and independent errors/forms. Duplicate/global busy/departure guards
refuse Refresh. Explicit Add/remove/toggle submissions invalidate older reads;
full reload invalidates before rules GET. Epoch/project/lifetime fence late
replies. No API/schema change; existing project-scoped authenticated endpoint.

## Product review
Saved rule metadata only, not an execution or authority check. Refresh never
creates/removes/enables/runs rules, reloads providers/webhooks or repairs config.
No complete-run-history or delivery claim. Kept receipts describe earlier writes,
not the current state of every row. Failed read retains prior list with bounded
retry. New-rule trigger/action/provider/locales/title/message/name stay local.

## Design review
Named Refresh and live status linked to literal scope help. Pixel inspection
found existing Activity link/help text touching; explicit spacing fixed it.
Four updated actual success/failure desktop1278x899/mobile390x844 screenshots
re-inspected11:20: readable/fit. Mobile heading partly above viewport and later
controls below. Fixture names only, no secrets or redaction required.

## Security review
Bounded new feedback excludes raw errors. Same local authenticated metadata
endpoint, no worker/account/credential/registration/spend/license change. Real
stale-response tests discriminate actual explicit disable/Add/remove outcomes
when only epoch comparison is removed. Fixture never edits keys/translations,
so saved task-create rules are not triggered. No effects/providers/tokens/tasks/
webhooks/deliveries/rules/translations remain. No authority-validation claim.

## QA review
Twelve new units and initial build FIRST RC0 actualweb/APIcached. Focus FIRST
13/0 RC0. Deliberate epoch comparison removal10PASS/3targetedFAIL RC1 at actual
disable/Add/remove; restored13/0 RC0. Visual spacing fix then13/0 RC0 again.
Real read-only retry, empty snapshot/draft preservation and route departure
covered. Broad checks pending. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

### Broad checkpoint11:50
Related name13/payload14/pending11/remove11/toggle11 FIRST RC0 each separate
browser call. All API groups FIRST RC0 including sync-preview644,automations132,
2fa37,SAML55,tags9. Sync stages95+144=239/native116+111+19=246 FIRST RC0,
each stage separate call; nativePG56062/four repeated startup checks. Config
sync16/native14/docs4/glossary3/runner4 FIRST0. Browser001-040 currently green;
023 initial and unchanged retry aborted before assertions on Postgres55660 bind
with0PASS/1abortFAIL despite inner RC0 (wrapperRC1). No live postgres found;
/proc/net/tcp confirmed a loopback client TIME_WAIT to API3000. Continued024/025,
then unchanged second retry023 passed5/0RC0. Initial/retry1 logs preserved.
Other39 FIRST0. No app/fixture change for this transient collision. Remaining
041-229/final verification/publication pending, no canonical uninterrupted claim.

### Broad checkpoint12:23
Browser041-136 FIRST RC0, each suite separate call. Current001-136 green;
023 transient collision chronology above retained. No code/fixture changes in
this run. Remaining137-229/final verification/publication pending.

### Broad checkpoint12:57
Browser137-229 FIRST RC0, each suite separate call. All229 current suites green,
2701PASS/0FAIL;228FIRST0 and023 transient bind chronology above retained.
Final units/build RC0, actualweb/APIcached after visual spacing fix; docs4 RC0,
new script syntax and diff checks RC0. Final pixels/publication pending.

### Final review12:57
Four latest success/failure desktop/mobile images visually inspected again:
Refresh/help/status readable at390px, existing Activity text now separated;
heading partly above mobile viewport, later controls below. Developer/PM/design/
security/QA rechecked actual diff and12unit cases, same scoped read-only result.
No secrets in fixture screenshots. No extra authority or runtime capability
claim. All checks above cover final code; only review text appended afterward.
