# Guard team-group deletion confirmation and pending state

## Developer review
Matching loaded group required; global busy and same-group name/role/locales/
member pending work refuse start/submit. During deletion, same-group saves,
member add/remove and draft discard refuse; named disabled controls agree.
Group-member removal now marks its existing shared member-work pending state and
clears it in finally. Accepted DELETE filters local groups, closes confirmation,
records receipt, then groups-only refresh, not full Settings reload. Refusal
retains confirmation/group/drafts; missing target cannot be retried locally.
No API/schema change. No concurrency guarantee against another client.

## Product review
Warning now says team-wide group/grant deletion, direct team membership and other
group grants remain, assigned tasks become unassigned, tasks/translations remain.
No revocation-all-access, deletion-limited-to-current-project or undo promise.
Existing API transaction handles task unassignment and group membership cascade.

## Design review
1278x899 desktop and390x844 mobile confirmation/accepted pixels inspected. Target,
team-wide warning, controls, receipt and retained new-group draft readable, no
overflow. Remaining group content partly above accepted mobile viewport.

## Security review
Only disposable local team/group/member/task fixtures. Existing server admin and
strictly-higher-than-group-role checks unchanged. UI confirmation is extra safety,
not authorization. Cross-project test proves actual effective-grant removal via
member-authorized PATCH before deletion and403 after, with direct visibility kept.
No external registration/spend/worker/credentials/scope/license change.

## QA review
Nine initial units/first buildRC0, web actual/APIcached. First focused run aborted
before checks: fixture ordered Translation by nonexistent id; corrected fixture
only to rowId, no assertion removed or app fix. Corrected16/0. Matching-confirmation
ONLY deliberate negative0PASS2FAILRC1; restored16/0; expanded17/0.
Actual browser/API/PostgreSQL covers no-confirm/wrong/cancel/pending edit,
403 retry, held-delete duplicate/cancel/replace/same-group saves/member/discard,
accepted503 local+server+receipt/no-retry/drafts and success groups-only refresh.
Two projects' assigned group tasks become unassigned; other group assignment stays,
all three tasks and translation bytes remain. Deleted-group membership cascades,
direct and other-group membership/visibility remain. Grant worked in second
project before deletion then update403 afterward, saved description unchanged.
Zero webhook deliveries/runtime errors. Full regression pending.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Completed regression
All214 browser suites FIRST RC0, 2443PASS/0FAIL, each own call. API groups
firstRC0 including sync-preview644,automations132,2FA37,SAML55. Sync stages
95+144=239 firstRC0. Native first116/0 then middle110PASS1FAIL because old
fixture still dismissed/accepted native dialog and clicked Delete twice. Fixed
fixture ONLY to actual inline Cancel/Yes controls, retained all assertions, no
app fix. Failed middle cleaned checkpoint: recreated required first116/0, then
corrected middle111/0 and tail19/0 =246 staged valid. Not all-first-pass native.
Config16/14,docs4,glossary harness3,runner4 firstRC0; final units/build both
projects cachedRC0.

Four confirmation/receipt desktop/mobile pixels re-inspected after broad regression; readable and no overflow. Remaining group partly above accepted mobile viewport.
