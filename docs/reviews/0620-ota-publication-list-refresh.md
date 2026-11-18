# Explicit read-only retained OTA publication metadata Refresh

## Developer review
Existing project-authenticated GET only. Keeps selected publish branch, earlier
receipt, all unrelated drafts/errors and branch-choice snapshot. Duplicate/
global-busy/departure guards refuse Refresh; explicit Publish and full reload
invalidate older reads. Epoch/project/lifetime fence replies. Existing Publish
now refuses duplicate/global-busy/departed handler calls before invalidation.
No API/schema change. Retained metadata only, payloads are not downloaded.

## Product review
Refresh is not Publish, bundle verification, deployment or CDN/native readiness.
List is a retained window, not complete release history. Earlier receipt can
refer to a pruned publication; kept branch can be absent from server choices.
No silent branch fallback. Error keeps prior metadata with bounded retry. Refresh
does not reload branch choices, repair configuration or verify current bundle
availability. Immutable existing publications and explicit Publish stay separate.

## Design review
Named Refresh and status linked to literal scope help. Initial screenshot framing
clipped mobile heading, so fixture scroll offset only adjusted and14/0 rerun.
Four updated actual success/failure desktop1278x899/mobile390x844 screenshots
inspected13:02: heading/Refresh/help/status/list readable/fit390px. Publish and
earlier receipt extend below mobile viewport. Fixture content only, no secrets.

## Security review
New bounded feedback excludes raw errors. Existing project-authenticated metadata
endpoint only; no extra account/worker/spend/credential/registration/license or
remote publication. Local fixture explicit Publish produces only local retained
bundles; Refresh GET never fetches payloads. Epoch-negative distinguishes actual
newer Publish from late success/failure. No runtime deployment/integrity claim.

## QA review
Nine new units/initial build FIRST RC0 actualweb/APIcached. Focus FIRST14/0RC0.
Removing ONLY epoch comparison12PASS/2targetedFAILRC1 at actual newer Publish
with old success/late503. Restored14/0RC0. Visual framing adjustment then14/0
again. Actual pending Publish duplicate refusal, external newer publication,
empty list/missing selection, independent forms/receipts/errors and actual route
departure covered. No bundle fetches/effect providers/tokens/tasks/webhooks/
deliveries/rules remain. Broad checks pending.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

### Broad checkpoint13:30
Related OTA browser25/download9 FIRST RC0. All API groups FIRST RC0 including
OTA46/sync-preview644/automations132/2fa37/SAML55/tags9. Sync95+144=239 and
native116+111+19=246 FIRST RC0 each stage own call/nativePG56064/four repeated
startup checks. Config16/14/docs4/glossary3/runner4 FIRST0. Browser001-036 FIRST
RC0 each suite separate call. No broad failure/interruption so far. Remaining
037-230/final verification/publication pending. No canonical uninterrupted claim.

### Broad checkpoint14:02
Browser037-127 FIRST RC0 each suite separate call. Current001-127 FIRST0;
no broad failure/interruption or code/fixture changes. Remaining128-230/final
verification/publication pending.

### Broad checkpoint14:32
Browser128-209 FIRST RC0 each suite separate call. Current001-209 FIRST0;
no broad failure/interruption or code/fixture change. Remaining210-230/final
verification/publication pending.

### Final review14:42
All230browser suites FIRST RC0 each own call,2715PASS/0FAIL. No broad failures or
interrupted suites. Finalunits/build2/2cachedRC0 (initial actualweb/APIcached0),
docs4/syntax/diffRC0. Four latest actual success/failure desktop/mobile pixels
visually re-inspected14:41: heading/Refresh/help/status/list fit390px; Publish and
receipt below mobile viewport. Developer/PM/design/security/QA rechecked diff
and9unit cases. No secret screenshot content, extra authority or runtime claim.
All checks cover final code; only review text appended afterward.
