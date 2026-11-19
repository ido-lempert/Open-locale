# Retained missing new-rule target locales

## Developer review
Read-only exact non-base comparison, stable unique display only, no stored list
rewriting. Unloaded project returns no invented targets. Reuses existing explicit
local toggle for uncheck. No fallback/setter on refresh, new read/API/schema or
changed explicit confirmed locale deletion. Inactive action hides only display.

## Product review
Kept targets after locale removal are now visible checked choices instead of
hidden draft state. Uncheck removes only that local code, not saved rules or Fill
empty target. Returning loaded target uses original checked list. Base locale not
silently substituted. No locale addition/repair/live permission guarantee.

## Design review
Initial pixels01:41 exposed new missing checkbox above centered label. Fixed only
missing-choice label to inline-flex with natural checkbox width and wrapping.
Corrected desktop1278x899/mobile390x844 pixels inspected01:42: new missing checkbox
immediately before exact code/reason; warning/control/Add rule and draft guidance
readable and fit390px. Existing loaded fr checkbox still above its label, unchanged
and not claimed fixed. Headings/form inputs above viewport. No secrets.

## Security review
Plain text interpolation, no new request or saved effect. Real local confirmed
locale removal plus503 follow-up; no external MT, accounts/worker/spend/credential
scope/registration/license changes. Existing explicit local checkbox toggle only.
No translation/publication/token/task/webhook/delivery/saved-rule effects.

## QA review
Initial five units FIRST0 actualweb/APIcached91s/build FIRST0 actualweb/APIcached
15.3s before label layout fix. Focus FIRST14/0, checked-binding-only negative
10PASS/4targetedFAILRC1, restored14/0. Corrected design focus14/0. Covers actual
confirmed removal+503, checked control/no duplicate, inactive/return action,
explicit local uncheck, zero targets, returned target/base/exact case/duplicate
stored list, expected5reads/2requested deletes/no rule or work writes. Unit covers
unloaded/empty/exact/stable unique/non-base/read-only/toggle/returned code.
Corrected units/build/broad checks pending.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

### Broad checkpoint02:05
Corrected units/build FIRST0 actualweb/APIcached95s/14.9s. All API groups FIRST0,
sync239/native246PG56076 FIRST0 each stage own call/four native startup repeats.
Config16/14/docs4/glossary3/runner4 FIRST0. Browser001-010 FIRST0 each own call.
No app/fixture edits during broad checks. Remaining011-235/final checks pending.

### Broad checkpoint02:33
Browser011-060 FIRST0 each suite own call. Current001-060 FIRST0, no exception or
app/fixture edits. Earlier API/sync/native/config preserved. Remaining061-235/
final verification/publication pending.

### Broad checkpoint03:05
Browser061-116 FIRST0 each suite own call. Current001-116 FIRST0, no exception or
app/fixture edits. Earlier API/sync/native/config preserved. Remaining117-235/
final verification/publication pending.

### Broad checkpoint03:36
Browser117-200 FIRST0 each suite own call. Current001-200 FIRST0, no exception or
app/fixture edits. Earlier API/sync/native/config preserved. Remaining201-235/
final verification/publication pending.

### Final review03:56
All235 browser suites FIRST0,2785PASS/0FAIL, each suite own call. AllAPI FIRST0,
sync239/native246PG56076 FIRST0 each stage own call/four native startup repeats.
Config16/14/docs4/glossary3/runner4 FIRST0. No app/fixture edits during broad checks.
Final units/build RC0,2/2 cached each, corrected actual web runs retained. Final
docs4/syntax/diff0. Two final pixels reinspected03:56: new missing checked target
inline before exact code/reason, complete warning/Add rule/draft guidance readable
and fit390px. Existing loaded fr checkbox remains above its label, unchanged.
Headings/inputs above viewport. No secrets. Developer exact non-base stable unique
read-only comparison, product local-draft-only/no repair scope, design corrected
pixels, security no new write/disclosure path and QA discriminatory checked-only
negative10/4/restored14 plus corrected focus/broad regression all reviewed.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
