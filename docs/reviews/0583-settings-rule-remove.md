# Guard automation-rule removal confirmation and pending state

## Developer review
Match confirmation to an existing rule, including direct calls. Busy guard blocks
start/cancel/remove. Accepted DELETE removes only target locally before list
refresh and closes confirmation. Refusal preserves list/confirmation for retry.
Review caught Enable/Disable overlapping removal and resetting busy; toggle now
guards busy and its button disables while pending. No API/schema/engine changes.

## Product review
Warning names rule and says removal cannot be undone. Earlier effects are not
undone and a run in progress may finish; no cancellation promise. Existing server
revision/current-rule checks remain unchanged. Saved receipt distinguishes removal
from failed list refresh. Other rules, forms and previous results stay.

## Design review
1278x899 desktop and390x844 mobile confirmation/accepted pixels inspected after
full regression: warning/buttons/receipt fit, no overflow. Other-rule name
above accepted mobile view;503 error below. All four latest pixels inspected.

## Security review
Disposable local disabled rules only, no trigger writes, task/translation changes
or deliveries. No worker enablement, real credential/scope/account, spend,
registration or license change. UI guards supplement unchanged server admin checks.
No notification/run acceptance promotion.

## QA review
Six initial units webactual/APIcachedRC0, initial build sameRC0. Focus first10/0;
matching-confirmation-only removal negative0PASS2FAILRC1. Restored10/0.
Toggle overlap fix expanded focused11/0: no PATCH/enable, remaining rule disabled.
Review-update units initiallyRC1: fixture bulk edit incorrectly inserted toggle
blocking assertion after completed403 with busy=false. Removed that misplaced
check only, kept busy-case assertion; corrected units/build webactual/APIcachedRC0.
No app fix for that fixture failure. Actual PostgreSQL selected row removal,
403 retry context, held duplicate/cancel/start/toggle guards, DELETE then503 local
fallback/receipt/no retry and retained name/title/other form. Zero tasks,
translations, webhook deliveries or runtime errors.
APIa/b/c/d and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync95+144=239/native116+111+19=246 firstRC0, native stages each their own call,
PG55968. Config16/14/docs4/glossary harness3/runner4 firstRC0.
Browser001..209 all FIRST2371PASSzeroFAILRC0, each suite own call, preserved
across run boundaries, not an uninterrupted run. Final web/API units/build cached
RC0; docs4/script syntax/diff checksRC0. Latest four pixels inspected again after209.
Coverage22FULL/7PARTIAL/1MISSING and defaultOFF unchanged.
