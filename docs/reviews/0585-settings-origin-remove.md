# Guard embed-origin removal confirmation and pending state

## Developer review
Require matching loaded-origin confirmation even on direct calls. Busy guards
block duplicate removal, cancel, target changes and Add origin. Accepted PATCH
updates the local project allowlist before project-only refresh, closes confirmation
and records receipt. Refusal retains list, confirmation and drafts for retry.
Review caught full reload resetting independent project-name drafts on success;
changed to project-only refresh before final focused verification. No API change.

## Product review
Explicitly retain existing whole-list replacement semantics, not an atomic server
remove or concurrency-safe merge. Warning says loaded list minus origin replaces
saved list. Receipt names accepted list save, not permanent current-state authority.
No claim to sign users out or close already-open frames. Separate new-origin and
other form drafts stay unchanged. No external acceptance promotion.

## Design review
1278x899 desktop and390x844 mobile confirmation and accepted-state pixels inspected.
Origin, warning, confirm/cancel, receipt and retained new-origin draft readable
without overflow. Remaining origin partly above mobile accepted viewport.

## Security review
Only disposable local .example origins in local PostgreSQL/API. Fresh embed CSP
verified to exclude removed origin and retain other. Existing session/admin API
checks unchanged; UI guard is not authorization. No external site requests,
account/credential/scope/license/spend/worker/SSO changes.

## QA review
Initial seven units webactual/APIcachedRC0 and initial build sameRC0. After review
project-only refresh change, seven units and builds again webactual/APIcachedRC0.
Focus first13/0; deliberate matching-confirmation-only negative0PASS2FAILRC1;
restored13/0; expanded14/0 adds successful refresh preserving independent drafts,
no assertion removed. Real local browser/API/PostgreSQL: unconfirmed/mismatch/cancel,
403 explicit retry, held duplicate/cancel/target/Add guards, accepted503 local/server
list and receipt/no retry, fresh CSP, actual DB list, final-origin empty list,
successful project-only refresh, zero tasks/translations/deliveries/runtime errors.
API batches and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync95+144=239 and native116+111+19=246 all firstRC0, each stage own call.
Config16/14/docs4/glossary harness3/runner4 firstRC0. Broad browser001..211
all firstRC0,2397PASS/0FAIL, each own call. Final web/API units/buildsRC0
(both cached), docs4/syntax/diffRC0. Four latest confirmation/accepted desktop
and mobile screenshots reinspected after211; warning/buttons/receipt/draft fit. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
