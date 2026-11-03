# 0272 - Visible usage window and ranking limit

## Developer review
Usage template displays exact since/asOf response strings in time elements, UTC
calendar-day note and separate-read snapshot caveat. Ranking header now Top5
actors. No service/query/schema changes. Browser observes actual response before
asserting exact visible bounds, not hardcoded timestamps.

## Product review
Cutoff/window metadata already existed in API but was hidden on screen. Users can
now see the captured interval and five-actor limit. UTC strings retained exactly,
not misleading local-format conversion. No whole-report snapshot guarantee.
Coverage22 FULL/7 PARTIAL/1 MISSING/defaultOFF unchanged.

## Designer review
Inspected fresh480x930 fullpage from480x900 viewport. Window wraps legibly without
horizontal overflow, ranking limit readable, actor/task IDs and all task rows
visible in fullpage. Last task row is below initial900viewport, normal vertical
scrolling; not all rows fit above fold. Existing progress horizontal scroll stays.
Fresh480x900 earlier inspected too; no other UI changes.

## Security review
Angular interpolation escapes metadata. No new sensitive fields or external
disclosures, only existing response bounds. No cache/client-memory erasure claim.
Statement caveat does not assert atomic authorization or whole-report snapshot.

## QA/integration review
Browser212->214: exact captured HTTP response bounds/UTC/snapshotcaveat and top5
header. Reports114/API265/31/web146/9unchanged.43uniquelegs/12completedgreenbatches
individualinnerouter0;sync644/builds/reaper4/docs4/138routes0. Web bundle warning
persists (new total recorded in build log). NativeSTAGED116+128=244total/242unique
PG55534innerouter0/checkpointremoved,NOTuninterrupted. Noapp/testchangesafter native;
browser214 reran afterward and generated finalfullpage evidence.

### Interruption chronology
Initial combined webunit+build+browser call hit120s during audit fixture before
new report checks. Web146/buildgreen; browser incomplete, not counted. Verified own
orphan Nx/Chrome process groups and stopped them. Verified zombiePG/closed55479
before stale socket removal. Isolated browser214green, then final214rerunafter
native. No assertion failures/startupfailures or targetednegativecontrol.
