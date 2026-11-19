# Read-only project locale list Refresh

## Developer review
Existing project GET applies locales only, preserving other loaded project fields.
Captures project object, project ID and epoch; old response/failure cannot replace
new accepted project state. Reload invalidates at entry; departure invalidates.
Separate active/fresh checks clear pending even if project replacement rejects
response. Duplicates/busy/unloaded/active confirmation refuse captured handler.
Final initial review added response-time busy/confirmation fence so a newly opened
real removal preview cannot disappear under an in-flight refresh.

## Product review
Recover added/removed project locale choices without general Save or whole reload.
Targets/rule drafts/results kept; missing targets remain explicit, not repaired.
Reads project metadata but applies locale list only, not a general metadata
refresh. No locale add/remove, save rule, run work or live availability/permission
promise. Existing Add/Remove unchanged and separate explicit actions.

## Design review
Four actual success/failure desktop1278x899/mobile390x844 pixels inspected04:16:
Refresh/scope/feedback/locales/Add draft/actions readable and fit390px. Mobile
Locales heading partly above viewport under fixed header; body/action/feedback
fully readable. No secret content. role=status and described scope.

## Security review
Read-only existing authenticated GET, no API/schema/account/worker/spend/license/
registration/credential scope change. Plain interpolated bounded errors, no raw
server error. Test uses real external-to-UI local API add/delete/general update,
UI itself sends zero writes. No external MT or work execution.

## QA review
Initial combined units interrupted by execution limit before web result, API
cached pass only. No surviving process, original log retained. Narrow12units0;
unchanged full retry0 actualweb/APIcached85s. Build FIRST0 actualweb/APIcached15.5s.
Focus FIRST16/0; whole-project replacement-only negative11PASS/5targetedFAILRC1,
restored16/0. Added busy/confirmation response fence, corrected focus17/0, includes
actual removal preview during held Refresh. Corrected units/build/broad pending.
Real added/removed/returned locale updates actual Fill empty/rule controls while
kept choices/drafts/results/other metadata remain. 503/retry, project replacement,
project-only reload old success/failure, active confirmation, route departure,
zero UI writes and no work side effects. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF
unchanged. No canonical uninterrupted units claim.

### Broad checkpoint04:38
Corrected units/build RC0 actualweb/APIcached91s/14.5s. AllAPI groups FIRST0,
sync239/native246PG56078 FIRST0 each stage own call/four native startup repeats.
Config16/14/docs4/glossary3/runner4 FIRST0. Browser001-005 FIRST0 each own call.
No app/fixture edits during broad checks. Remaining006-236/final checks pending.
Initial interrupted units chronology retained above, no uninterrupted claim.

### Broad checkpoint05:07
Browser006-080 FIRST0 each suite own call. Current001-080 FIRST0, no exception or
app/fixture edits. Earlier API/sync/native/config preserved. Remaining081-236/
final verification/publication pending. Initial units interruption retained.

### Broad checkpoint05:38
Browser081-160 FIRST0 each suite own call. Current001-160 FIRST0, no exception or
app/fixture edits. Earlier API/sync/native/config preserved. Remaining161-236/
final verification/publication pending. Initial units interruption retained.

### Broad checkpoint06:09
Browser161-215 FIRST0 each suite own call. Current001-215 FIRST0, no exception or
app/fixture edits. Earlier API/sync/native/config preserved. Remaining216-236/
final verification/publication pending. Initial units interruption retained.

### Final review06:25
All236 browser suites FIRST0,2802PASS/0FAIL, each suite own call. AllAPI FIRST0,
sync239/native246PG56078 FIRST0 each stage own call/four native startup repeats.
Config16/14/docs4/glossary3/runner4 FIRST0. No app/fixture edits during broad checks.
Final units/build RC0,2/2 cached each, earlier corrected actual web runs retained.
Initial units interruption/retry preserved, no uninterrupted claim. Final docs4/
syntax/diff0. Four final success/failure desktop1278x899/mobile390x844 pixels
reinspected06:25: Refresh/scope/feedback/locales/Add draft/actions readable and
fit390px; mobile Locales heading partly above viewport under fixed header, body
fully readable. No secrets. Developer locales-only apply/current-object+epoch
fences, product read-only/draft preservation, design above, security zero UI writes
and QA discriminating whole-project replacement negative11/5/restored16 then
corrected17 plus full regression reviewed. Coverage22FULL/7PARTIAL/1MISSING/
defaultOFF unchanged.
