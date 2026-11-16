# Guard custom-status removal confirmation and pending state

## Developer review
Matching loaded custom-status confirmation and busy guard apply to direct calls.
Accepted whole-list PATCH updates local project before project-only refresh,
closes confirmation and records receipt. Refusal retains retry context. Uses
project-only refresh to preserve independent form drafts. No API/schema change.

## Product review
Warning and receipt explicitly retain existing whole-list replacement semantics;
not an atomic or concurrency-safe server remove. Translations already carrying
the removed status are unchanged. Base statuses remain always available. New-status
and independent form drafts stay. No external acceptance promotion.

## Design review
1278x899 desktop and390x844 mobile confirmation/accepted pixels inspected. Selected
status, warning, buttons, saved receipt and retained draft readable without
overflow. Remaining status partly above mobile accepted viewport.

## Security review
Disposable local custom statuses and one local translation fixture only. Existing
backend admin checks unchanged; UI guard does not replace authorization. No
external requests/accounts/credential/scope/spend/worker/license change.

## QA review
First unitsRC1: four failures in copied fixture using embedStatuss instead of
customStatuses. Corrected fixture only, retained all assertions, no app fix for
this failure. Corrected seven units webactual/APIcachedRC0; first build sameRC0.
Focus first13/0; matching-confirmation-only deliberate negative0PASS2FAILRC1;
restored13/0; expanded14/0 adds actual translation carrying removed custom status
and verifies row/history unchanged. Real browser/API/PostgreSQL: unconfirmed,
mismatch/cancel,403 retry, held duplicate/cancel/start/Add guards, accepted503
local/server list/receipt/no stale retry, final empty list, successful project-only
refresh preserves drafts. One existing translation unchanged; zero tasks, extra
translations, webhook deliveries and runtime errors. No assertions removed.
API batches and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync95+144=239 and native116+111+19=246 all firstRC0, each stage own call.
Config16/14/docs4/glossary harness3/runner4 firstRC0. Broad browser001..212
all firstRC0,2411PASS/0FAIL, each own call. Final web/API units/buildsRC0
(both cached), docs4/syntax/diffRC0. Four latest confirmation/accepted desktop
and mobile screenshots reinspected after212; warning/buttons/receipt/draft fit. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
