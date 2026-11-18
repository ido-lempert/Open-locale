# Explicit read-only OTA publish branch choices Refresh

## Developer review
Existing project-authenticated session-only branches GET. Changes choices only,
not selected branch, publication metadata, earlier receipt, unrelated drafts or
independent errors. Duplicate/global-busy/departure guards; full reload invalidates
before branch read; epoch/project/lifetime fence pending replies. No API/schema
change or mutation. Explicit missing-selected option prevents visual fallback.

## Product review
Refresh does not create/merge/delete branches, publish/download bundles or reload
publication metadata. Loaded choices do not prove current availability or publish
permission. Missing selection stays exact, visibly marked not in loaded choices;
no automatic branch replacement. Failure keeps old choices with bounded retry.
No deployment/CDN/native or complete release-history claim. Full reload remains
existing broad behavior, not a draft-preserving action introduced by this slice.

## Design review
Named Refresh, linked literal scope help and separate bounded status. Actual
success/failure desktop1278x899/mobile390x844 pixels inspected14:46: Refresh/help/
status/selection/Publish/receipt readable/fit390px. OTA heading above mobile
viewport. No secret content. Missing selection explicitly labeled in option and
status; no ambiguous blank select or silent first-choice appearance.

## Security review
Existing session/project-authenticated metadata only; no worker/account/spend/
credential/registration/license change. New bounded feedback excludes raw error.
Local fixture creates/deletes empty local branches only. No publications,
translations, providers, tokens, tasks, webhooks, deliveries or rules. Negative
epoch test discriminates real full reload newer branch success and late503.

## QA review
Nine new units and initial build FIRST RC0 actualweb/APIcached. Focus FIRST13/0;
epoch-only negative11PASS/2targetedFAILRC1 at real full-reload newer-branch success/
late503; restored13/0RC0. Actual external add/remove, empty snapshot, exact missing
selection and no Publish, duplicate guards, retained unrelated state and actual
route departure covered. Broad checks pending.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

### Broad checkpoint15:04
Related publicationRefresh14/OTA25 FIRST RC0. All API groups FIRST RC0 including
branches56/OTA46/sync-preview644/automations132/2fa37/SAML55/tags9. Sync239 and
native246 FIRST RC0 each stage own call/nativePG56066/four repeated startup checks.
Config16/14/docs4/glossary3/runner4 FIRST0. Browser001-008 FIRST RC0 each suite
separate call. No broad failure/interruption/change. Remaining009-231/final
verification/publication pending.

### Broad checkpoint15:34
Browser009-077 current green each own call.067 initially0PASS/1abortFAIL despite
innerRC0 (wrapperRC1), Postgres55628 bind before assertions. No live postgres
found; socket cleared before /proc inspection, TIME_WAIT not confirmed.068FIRST0,
then067 unchanged retry6/0RC0. Initial log preserved, no app/fixture edits. Other
76FIRST0 overall. Remaining078-231/final verification/publication pending;
no canonical uninterrupted claim.

### Broad checkpoint16:04
Browser078-150 FIRST RC0 each suite own call. Current001-150 green,149FIRST0 plus
067 initial bind abort/unchanged retry chronology above. No new exception or
code/fixture changes. Remaining151-231/final verification/publication pending.

### Broad checkpoint16:34
Browser151-220 FIRST RC0 each suite own call. Current001-220 green,219FIRST0 plus
067 initial bind abort/unchanged retry chronology above. No new exception or
code/fixture changes. Remaining221-231/final verification/publication pending.

### Final review correction16:42-16:47
Pre-fix231browser current2728/0 and finalcached units/build/docs0 are historical,
not certification of this correction. Final diff caught an unintended global
text replacement inserting OTA missing-selection option into pre-translation.
Removed it and split OTA publish choices into their own signal, initially copied
on full reload, so OTA Refresh does not change unrelated pre-translation choices.
Added actual pre-translation selector assertion. First added assertion fixture
aborted because no provider meant form absent; added offline local provider and
cleanup. Corrected focus14/0, corrected epoch-negative12PASS/2targetedFAILRC1,
restored14/0. Corrected units/build actualweb/APIcachedRC0. Full corrected browser
regression/staged checks/final pixels pending. Earlier API code unchanged.

### Corrected regression checkpoint17:05
Corrected sync239 and native246 FIRST RC0, each stage separate call, nativePG56068
and four startup repeats. Corrected browser231 FIRST14/0;001-020 current green.
007 initially0PASS/1abortFAIL, innerRC0/wrapperRC1: Postgres55700 bind before
assertions. No live postgres; proc confirmed loopback client TIME_WAIT to5556.
008 FIRST0, then007 unchanged retry7/0RC0. Initial corrected log preserved.
Other19 FIRST0, each suite separate call. Corrected units/build actualweb/APIcached
RC0 as above. Corrected021-230/config/final checks/pixels/publication pending.
Earlier pre-fix browser evidence is historical only; no uninterrupted-run claim.

### Corrected regression checkpoint17:35
Corrected browser021-085 FIRST RC0, each suite separate call. Current001-085 plus
focused231 green:84 first-run passes plus007 initial bind-abort/unchanged retry
chronology above. No app/fixture change or new exception. Corrected067 passed
first run, separate from historical pre-fix067. Remaining086-230/config/final
checks/corrected pixels/publication pending. Completed corrected stages retained.

### Corrected regression checkpoint18:05
Corrected browser086-150 FIRST RC0, each suite separate call. Current001-150 plus
focused231 green:149 first-run passes plus007 initial bind-abort/unchanged retry
chronology above. No app/fixture change or new exception. Remaining151-230/config/
final checks/corrected pixels/publication pending. Completed stages retained.

### Corrected regression checkpoint18:35
Corrected browser151-213 FIRST RC0, each suite separate call. Current001-213 plus
focused231 green:212 first-run passes plus007 initial bind-abort/unchanged retry
chronology above. No app/fixture change or new exception. Remaining214-230/config/
final checks/corrected pixels/publication pending. Completed stages retained.

### Corrected final review18:43-18:45
All231 corrected browser logs total2729PASS/0FAIL.230 suites FIRST RC0;007 initial
bind abort/unchanged retry retained above. No app/fixture changes during corrected
broad run. Count rose by one from pre-fix2728 due to the actual unrelated
pre-translation selector/snapshot regression assertion. Corrected sync239/native246
PG56068 FIRST RC0, each stage separate call, four startup repeats. Earlier API
FIRST RC0 retained with unchanged API code, not runtime-UI certification.
Corrected config16/14/docs4/glossary3/runner4 FIRST RC0. Final units/build RC0,
2/2 tasks cached each; actual corrected web executions recorded earlier. Syntax
and diff checks RC0. Reinspected all four corrected success/failure desktop1278x899
and mobile390x844 pixels18:43: Refresh/help/feedback/selection/Publish/receipt
readable and fitting; mobile heading above viewport. Independent error is fixture
state preserved intentionally. No clipping of the new controls or secret content.
Final developer review confirms isolated OTA choices and unchanged MT snapshot;
product scope remains read-only metadata choices, no live permission guarantee;
design inspected above; security no raw-error feedback/account/worker/credential
change; QA corrected regression and targeted negative tests retained. No canonical
uninterrupted claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
