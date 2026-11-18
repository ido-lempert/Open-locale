# Explicit read-only pre-translation branch choices Refresh

## Developer review
Existing session/project-authenticated branches GET. Changes pre-translation
choices only. Exact selected provider, locale and branch, earlier pseudo result,
OTA choice snapshot, publications, receipts and unrelated forms remain. Duplicate,
global-busy and departure guards; epoch/project/lifetime fence old responses;
full reload invalidates before branch read. Missing selected branch option stays
inside the MT selector only, with actual OTA selector/snapshot isolation assertion.

## Product review
Explicit Refresh does not run Fill empty, create/merge/delete branches, reload
provider metadata or OTA choices. Loaded choices do not prove live availability
or permission. Missing selection remains exact and marked, without replacement.
Failure keeps previous choices with bounded retry. Full reload remains broader
existing behavior, not a draft-preserving action introduced here. Offline pseudo
TEST DATA only; no real MT/AI enablement or quality claim.

## Design review
Named Refresh and linked literal scope help plus separate bounded status. Four
actual success/failure desktop1278x899/mobile390x844 pixels inspected18:50. New
button/help/feedback/provider/locale/branch/Fill empty/earlier result readable and
fit390px. MT heading above viewport. No secret content. A transient image-read
transport failure retried successfully; all four inspected. Missing selected
branch visibly marked in option and status, not an ambiguous blank/fallback.

## Security review
Existing metadata read only; no API/schema change, worker/account/spend/credential/
registration/license change. Bounded feedback excludes raw errors. Local fixture
creates/deletes empty branches and offline provider only, no translations or
publications and no remaining provider, token, task, webhook, delivery or rule.
No external provider calls. Negative epoch test discriminates full reload with
newer real branch, old success and late503. No authority inferred from choices.

## QA review
Nine new units FIRST RC0, actualweb/APIcached~68s; build FIRST RC0 actualweb/APIcached
13s. Focus FIRST14/0, epoch-only negative12PASS/2targetedFAILRC1 at full-reload
newer-branch success/late503, restored14/0RC0. Actual external add/remove, empty
choices, exact missing name, duplicate refusal, bounded503/retry, real route
departure, OTA isolation and no write effects covered. Broad verification pending.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

### Broad checkpoint19:04
All API groups FIRST RC0 including branches56/MT55/OTA46/sync-preview644/
automations132/2fa37/SAML55. Staged sync95+144=239 FIRST RC0 each stage own call.
Native first116 FIRST RC0, PG56070; middle/tail still required. No broad failure,
app change or fixture change.232-suite browser regression not started; config/
final checks/publication remain pending.

### Broad checkpoint19:34
Native middle111/tail19 FIRST RC0, combined246 PG56070 with four repeated startup
checks, each stage separate call. Config16/14/docs4/glossary3/runner4 FIRST RC0;
syntax/diff0. Browser001-053 current green,52 FIRST0 plus049 initially0PASS/
1abortFAIL innerRC0/wrapperRC1: PG55684 bind before assertions. No live postgres;
proc confirmed loopback client55684 TIME_WAIT to55685.050 FIRST7/0, then049
unchanged retry7/0RC0. Initial log preserved; no app/fixture edits. Remaining054-
232/final verification/publication pending. No canonical uninterrupted claim.

### Broad checkpoint20:03
Browser054-120 FIRST RC0, each suite separate call. Current001-120 green,
119FIRST0 plus049 initial bind-abort/unchanged retry chronology above. No new
exception or app/fixture edits. Remaining121-232/final verification/publication
pending; completed API/sync/native/config retained.

### Broad checkpoint20:33
Browser121-187 FIRST RC0, each suite separate call. Current001-187 green,
186FIRST0 plus049 initial bind-abort/unchanged retry chronology above. No new
exception or app/fixture edits. Remaining188-232/final verification/publication
pending; completed API/sync/native/config retained.

### Final review20:54
All232 current browser logs total2743PASS/0FAIL.231 suites FIRST RC0 plus049
initial bind-abort/unchanged retry chronology above. Every suite separate call;
no broad app/fixture edits. All API groups FIRST RC0; staged sync239/native246
PG56070 FIRST RC0, each stage own call, four native repeated startup checks.
Config16/14/docs4/glossary3/runner4 FIRST0. Final units/build RC0,2/2 tasks cached
each, actual web executions recorded earlier. Final docs4/syntax/diff RC0.
Reinspected all four final success/failure desktop1278x899/mobile390x844 pixels
20:54: button/help/feedback/provider/locale/branch/Fill empty/earlier result readable
and fit, heading above viewport. No secret content or clipping of new controls.
Final developer review confirms MT-only option and isolated OTA choices;
product review retains literal read-only scope and no current permission claim;
design inspected above; security no raw feedback/external provider call/worker/
account/credential change; QA negative epoch test and full regression retained.
No canonical uninterrupted-run claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF
unchanged. Existing Fill empty remains separate explicit work.
