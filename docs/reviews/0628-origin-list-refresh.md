# Read-only embed-origin allowlist Refresh

## Developer review
Existing project GET applies embedOrigins only. Captures project object, ID and
epoch; reload entry/departure invalidate. Separate active/current checks clear
pending after project replacement. Duplicate/busy/unloaded/confirmation refusal
and response-time busy/confirmation fences. Existing Add/Remove unchanged.

## Product review
Reload stale allowlist context without saving or dropping new-origin text and
other drafts/results/metadata. Empty allowlist supported. Not a conflict-checked
merge. No listed-site contact, site ownership/trust/permission validation, frame
closing or access-health promise. Later explicit Add/Remove remains loaded-list
replacement. Existing embedding help unchanged.

## Designer review
Six actual success/failure desktop1278x899/mobile390x844 head/draft views inspected
08:49-08:51. Heading/Refresh/scope/feedback readable; lower mobile view verifies
allowlist rows/new-origin draft/Add/Discard and guidance. All fit390px. No secrets.
Role=status and described scope. Initial head view alone did not show draft, so
added separate lower-view screenshot rather than claiming unseen actions.

## Security review
Existing authenticated GET only; bounded errors without raw body. Browser UI zero
mutations, zero outside-host requests, no translations/publications/tokens/tasks/
webhooks/deliveries/rules. Real separate localAPI allowlist/general PATCH and locale
addition discriminate list-only apply. No API/schema/account/worker/spend/license/
registration/credential-scope change. Refresh grants no origin access.

## QA review
Units FIRST0 actualweb/APIcached72s, build FIRST0 actualweb/APIcached13.5s. Focus
FIRST17/0; added outside-host assertion/lower pixel captures, whole-project
replacement-only negative14PASS/4targetedFAILRC1; restored18/0. Real server added/
removed/empty allowlist, actual rows/empty state, new-origin and other metadata/
drafts preserved,503/retry, actual new removal confirmation kept, captured handler
refusal, project replacement, reload old success/failure, actual departure, zero
UI writes/outside requests/work side effects. All regression/final checks pending.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

### Broad checkpoint09:20
AllAPI FIRST0 no exception. Sync239/native246PG56083 FIRST0 each stage own call,
four native startup repeats. Config16/14/docs4/glossary3/runner4 FIRST0. Browsers
001-030 FIRST0 each own call, no app/fixture changes or browser exception.
Remaining031-238/final verification/publication pending. No human blocker.

### Broad checkpoint09:53
Browser031-106 FIRST0 each own call, cumulative001-106 green. No app/fixture
changes or browser exception. Earlier API/sync/native/config results preserved.
Remaining107-238/final verification/publication. No human blocker.

### Broad checkpoint10:26
Browser107-179 FIRST0 each own call, cumulative001-179 green. No app/fixture
changes or browser exception. Earlier API/sync/native/config results preserved.
Remaining180-238/final verification/publication. No human blocker.

### Final review10:53
All238 browser suites FIRST0,2837PASS/0FAIL each own call. AllAPI/sync239/native246/
config FIRST0 results above preserved; no app/fixture edits during broad checks.
Final units/build RC0,2/2 cached each, earlier actualweb runs retained. Docs4/
syntax/diff0; final diff inspected. Six final head/draft success/failure desktop/
mobile pixels reinspected10:53, heading/Refresh/scope/feedback and lower rows/
new-origin draft/Add/Discard readable and fit390px, no secrets. Developer narrow
apply/current-object+epoch fences, product read-only/no merge promise, design
above, security no UI writes/outside contacts and QA discriminating14/4negative/
restored18/full regression reviewed. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF
unchanged.
