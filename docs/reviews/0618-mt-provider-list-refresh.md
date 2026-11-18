# Explicit read-only pseudo-provider metadata Refresh

## Developer review
GET provider metadata only. Keep draft name/type, Fill empty provider/locale/
branch/result, automation provider choice, receipts and independent errors.
Duplicate/global busy/departed guards refuse Refresh. Explicit Add/delete/toggle
submissions invalidate older reads; full reload invalidates before providers GET.
Epoch/project/lifetime checks fence late replies. Metadata-only Refresh makes no
fallback selection. No API/schema change. Existing list endpoint is project-
scoped and authenticated; response is not a runtime availability check.

## Product review
Pseudo test data only, unchanged. Refresh never adds/removes/enables providers,
runs Fill empty, repairs saved rules or enables real translation. Kept choices
may refer to providers absent from the new snapshot; help says to review before
an explicit run/save. Previous result remains historical. No health claim or
automatic run. Failed reads retain previous list with bounded retry guidance.

## Design review
Named Refresh/live status with literal scope help. Four actual success/failure
desktop1278x899/mobile390x844 screenshots inspected09:38: readable and fit.
Mobile heading partly above viewport and later controls below. Existing bold
pseudo test-data warning retained. Fixture names only, no secrets/redaction.

## Security review
Bounded feedback never exposes raw errors. Same authenticated local metadata
endpoint; no new mutation, external provider request, worker, registration,
credential change, spend or license choice. Deliberate epoch removal makes three
real later mutation outcomes fail. Browser fixture removes all providers and
creates no tasks/tokens/webhooks/deliveries/rules/translations. No provider secret
or configuration is echoed by the new feedback.

## QA review
Twelve new units, initial units/build FIRST RC0 actualweb/APIcached. Focus
FIRST13/0 RC0; only epoch comparison removed10PASS/3targetedFAIL RC1 at actual
explicit disable/Add/remove boundaries; restored13/0 RC0. Explicit read-only
retry, valid empty snapshot with absent selection preservation and actual route
departure verified. Related name12/pending11/remove12/toggle11 FIRST0 each
separate. 228 browser suites FIRST2688PASS/0FAIL all RC0 each suite separate.
All API checks FIRST RC0 including tags9/preview644/automations132/2FA37/SAML55.
Sync95+144=239/native116+111+19=246 FIRST RC0, each stage separate, native56060,
four repeated startup checks. Configsync16/native14/docs4/glossary-reset3/runner4
RC0. No app/fixture changes during broad verification. Completed results retained
across run boundaries, no uninterrupted-run claim. Final units/build RC0,2/2
cached each; initial actualweb runs retained. Final five-perspective review found
no further fixes. Four images re-inspected11:15 readable/fit with mobile caveats
above. Final docs/syntax/diff checks follow this closeout text.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
