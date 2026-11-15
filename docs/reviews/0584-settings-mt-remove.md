# Guard offline provider removal confirmation and pending state

## Developer review
Match confirmation to existing provider, including direct calls. Busy guards block
start/cancel/remove/toggle/Fill empty overlap. Accepted DELETE removes target locally
before list refresh, closes confirmation, records receipt and applies existing
first-remaining Fill empty selection fallback before refresh failure. Refusal keeps
list/confirmation/selection for retry. No API/schema/engine change.

## Product review
Warning names provider, says irreversible; existing translations are not undone,
saved rules referencing it are not repaired and may fail, in-progress work may
finish. Receipt calls out existing first-remaining/none selection fallback and
asks review before running. Independent form drafts, including automation draft
provider reference, are not silently repaired. No promise of cancellation/undo.

## Design review
1278x899 desktop and390x844 mobile confirmation/accepted pixels inspected: warning,
buttons and receipt fit, no overflow. Other-provider name above accepted mobile
view,503 error below. Existing fallback provider selection visible lower down.
Full receipt stays readable though longer because it explains dependency/selection.

## Security review
Disposable local disabled pseudo providers only. No actual pre-translation,
provider enablement, tasks/translations/deliveries, worker, real credential/scope/
account, spend, registration or license change. Existing backend admin checks
unchanged. UI guards supplement authorization, not replace it.

## QA review
Initial six units webactual/APIcachedRC0, first build sameRC0. Expanded eight units
sameRC0 add final-provider empty selection and preserving other current selection.
Focus first11/0, matching-confirmation-only negative0PASS2FAILRC1, restored11/0.
Expanded12/0 adds final-provider removal with failed refresh and empty selection,
no assertion removal. Actual PostgreSQL selected row deletion/other disabled row,
403 retry context, held duplicate/cancel/start/toggle/Fill empty guards with no
PATCH/run, accepted DELETE then503 local fallback/receipt/no retry and retained
name/title/other form. Zero tasks/translations/deliveries/runtime errors.
No unintended focused/unit failing run.
APIa/b/c/d and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync first95/0; second interrupted by120s command limit after126PASS, no completion.
Stopped only orphaned Nx process group219974. Resume0PASS1FAIL before assertions:
PostgreSQL Unix socket lock from interrupted219913. Verified lock PID, zombie state
and TCP refusal; removed only stale socket/lock. Recovered second144/0 from valid
first-stage checkpoint, combined239. No app/source fix; logs preserved, not an
all-first-pass sync claim. Native116+111+19=246 firstRC0, each stage own call,
PG55968. Config16/14/docs4/glossary harness3/runner4 firstRC0.
Broad browser001..210 all firstRC0,2383PASS/0FAIL, each suite own call.
Final web/API units and buildsRC0, both projects cached. Desktop/mobile
confirmation and accepted-state pixels reinspected after suite210: warning,
buttons, receipt and fallback selection fit; retained name draft visible.
Docs4, browser-script syntax and git diff checksRC0.
Coverage22FULL/7PARTIAL/1MISSING and defaultOFF unchanged.
