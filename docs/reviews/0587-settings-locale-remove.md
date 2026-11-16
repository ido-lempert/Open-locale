# Guard locale removal confirmation and pending state

## Developer review
Matching loaded non-base locale confirmation and busy guard for direct removal.
Preview holds busy, cannot be replaced/cancelled mid-request; base/missing previews
make no request. Accepted DELETE removes target locally before project-only
refresh, closes confirmation and records receipt. Refusal retains retry context.
No API/schema change; project-only refresh preserves independent drafts.

## Product review
Old count was nonempty translations from listKeys default main branch, not all
rows being deleted. Warning now labels scope and says all locale translations
and history across branches, including empty rows, are permanently deleted.
Saved rules and local locale references are not repaired or silently changed;
review before running. No total-count, undo or restored-data promise.

## Design review
1278x899 desktop and390x844 mobile confirmation/accepted pixels inspected. Target,
count-scope warning, controls, receipt and retained add-locale draft readable and
no overflow. Remaining locale partly above accepted mobile viewport.

## Security review
Disposable local project/locales/translations only. Existing API authorization
and base-locale restriction unchanged; UI guards supplement rather than replace
it. No external requests/accounts/credential/scope/spend/worker/license change.

## QA review
Eight units and first build webactual/APIcachedRC0. First focused commandRC1 before
checks: generated-script splice syntax corrected. Corrected and diagnostic runs
14PASS/1FAIL: fixture assumed creating a branch copies translations; measured2
rows, preview1. Added explicit feature-branch populated/empty rows, retaining all
assertions and expected4; corrected15/0. No app fix for fixture failures.
Matching-confirmation-only deliberate negative0PASS2FAILRC1; restored15/0.
Actual browser/API/PostgreSQL: preview serialization, non-base/missing/mismatch/
cancel guards,403 retry, held deletion/duplicate/cancel/start/Add blocking,
accepted503 local/server list/receipt/no retry, all four target translations and
their history cascade across branches including empty rows, other-locale rows
unchanged, successful project-only refresh preserves drafts. Zero tasks/deliveries/
runtime errors. Broad regression pending.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Completed regression
All213 browser suites completed2426PASS/0FAIL current results. Each suite ran in
its own call. All first attempt except113: two pre-check PostgreSQL55772 startup
aborts (address in use); TCP refused and fresh bind initially failed; no live
Postgres/socket file observed, then no port-table entry. Preserved both failed
logs, no source/assertion changes;114 passed8/0 then113 recovered7/0. Do not call
this an all-first-pass browser run. API groups firstRC0 including separate
sync-preview644, automations132,2FA37,SAML55. Sync stages95+144=239 and native
stages116+111+19=246 firstRC0, each in its own call. Config16/14, docs4, glossary
harness3, runner4 firstRC0. Final units/buildRC0 both projects cached. Four
confirmation/receipt desktop/mobile pixels re-inspected after broad regression.
