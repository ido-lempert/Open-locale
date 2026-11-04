# 0303 - Activity role snapshot shapes

## Developer review
Shared strict shape guard checks non-array object, string role and string-array
allowedLocales before member.updated/group.updated nested dereferences. Missing or
malformed snapshots omit optional detail instead of throwing. Existing valid
summary output preserved. Three units exercise both sides across missing/null/
primitive/array/object/wrong field types and valid role/locale changes.

## Product review
Incomplete persisted audit rows retain actor/action/time while optional malformed
detail is omitted. Valid neighboring rows still display role/locale changes.
No inference of missing data, no current-state lookup, no history completeness
claim. This guards only member/group update role snapshots, not every detail format.

## Designer review
Fresh480x900 filtered group-update screenshot inspected: incomplete row retains
identity/time; valid row summary readable below. Controls/refresh/rows fit with no
new clipping. No layout change.

## Security review
Strict nested field checks avoid unsafe role method calls and locale joins.
Angular text interpolation unchanged; no HTML binding or new fields/API/schema.
Actual malformed persisted fixture plus valid neighbor renders without TypeError.
Local test writes only; no credentials/account scope/spend/license/provider change.
Original owner upload authority recovered before push.

## QA/integration review
API265/31/web189->192/11 uncached0/builds0. Activity18->20 actual persisted invalid/
valid snapshots for both actions; reports118/sync644/syncbrowser239/QA14 unchanged.
45uniqueintegration/configlegs inner/outer0; reaper4/docs4/138routes0. No failures,
timeouts or interruption. Native STAGED116+128=244total/242unique PG55534 inner/
outer0/checkpointremoved, not uninterrupted. No app/test edits after native.
Bundle573.75kBvs500warning(previous573.51). Docker static only/no daemon claim.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no remote/baseline advance/
accepted sync/enabledworker. Existing report snapshot/window caveats unchanged.
