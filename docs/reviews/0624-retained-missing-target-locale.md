# Retained missing Fill empty target locale

## Developer review
Read-only predicate compares exact nonempty mtLocale against loaded project
non-base codes. Unloaded project does not invent missing state. Explicit option
keeps the actual native selector aligned with retained state. Independent status
outside provider list condition remains visible when Fill empty form is hidden.
No setter, fallback, new read, API/schema change or altered run/remove semantics.

## Product review
Confirmed locale removal preserves local pre-translation target and rule drafts.
Display now explains retained missing target rather than looking like another
locale or blank selection. Explicit listed choice clears display only. Zero
remaining targets do not fall back to base. No locale addition, saved-rule repair,
permission or live availability promise. Earlier result is not a fresh receipt.

## Design review
Actual desktop1278x899/mobile390x844 pixels inspected23:27. Exact short code and
warning readable, target/provider/branch/actions and earlier result fit390px.
Native select truncates long reason; full explanation adjacent. Heading above
viewport. No secret content. Status uses plain interpolation and role=status.

## Security review
No new mutation/account/worker/spend/registration/license/credential scope.
Browser uses real local built API/Postgres confirmed locale deletion, with503
follow-up proving accepted local project state drives warning. No external MT.
No translation/publication/token/task/webhook/delivery/saved-rule side effects.
Existing explicit deletion only, not new effect inferred from display.

## QA review
Five units FIRST0 actualweb/APIcached93s, build FIRST0 actualweb/APIcached15.7s.
Browser FIRST14/0. Removed only missing-target option: negative10PASS/4targetedFAIL
RC1, restored14/0. Covers actual selector after confirmed removal+503, explicit
other choice, no remaining targets, unrelated provider choice, returned target,
base exclusion, empty unset and exact5reads/2requested deletes/no other UI writes.
Unit covers exact case/substrings/unloaded/read-only choices/result/drafts.
Broad regression pending. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

### Broad checkpoint23:53
All API groups FIRST0 including sync-preview644/automations132/2fa37/SAML55/
branches56/MT55. Sync239 and native246PG56074 FIRST0, each stage own call, four
native startup repeats. Config16/14/docs4/glossary3/runner4 FIRST0. Browser001-020
FIRST0, each suite own call. No app/fixture edits during broad regression.
Remaining021-234/final units/build/docs/syntax/diff/pixels/publication pending.

### Broad checkpoint00:22
Browser021-080 FIRST0, each suite separate call. Current001-080 FIRST0, no browser
exception or app/fixture edits. Earlier API/sync/native/config results preserved.
Remaining081-234/final verification/publication pending.

### Broad checkpoint00:50
Browser081-140 FIRST0, each suite separate call. Current001-140 FIRST0, no browser
exception or app/fixture edits. Earlier API/sync/native/config results preserved.
Remaining141-234/final verification/publication pending.

### Broad checkpoint01:19
Browser141-200 FIRST0, each suite separate call. Current001-200 FIRST0, no browser
exception or app/fixture edits. Earlier API/sync/native/config results preserved.
Remaining201-234/final verification/publication pending.

### Final review01:36
All234 browser suites FIRST0,2771PASS/0FAIL, each suite separate call. All API
groups FIRST0, sync239/native246PG56074 FIRST0 each stage own call/four native
startup repeats. Config16/14/docs4/glossary3/runner4 FIRST0. No app/fixture edits
during broad regression. Final units/build RC0,2/2 cached each; earlier actual
web runs retained. Final docs4/syntax/diff0. Two final desktop1278x899/mobile390x844
pixels reinspected01:36, warning/code/provider/target/branch/actions/result
readable and fit390px. Native select truncates reason, adjacent explanation
complete; headings above viewport, no secrets. Developer final exact-match and
non-base/read-only review, product retained-state-only/no repair scope, design
pixels above, security no new write/disclosure path and QA discriminatory
option-only negative10/4 then restored14/0 plus broad regression all checked.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
