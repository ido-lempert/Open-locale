# 0264 - Progress edge contracts

## Developer review
Test-only HTTP fixtures remove a custom status from project settings, retaining
its existing filled translation row. Progress must still expose its count and
reconcile translated with summed statuses. A second fixture assigns that status
to an empty translation before removing settings again; it must not inflate
filled or status totals. Empty branch checks every locale's zero totals/percent.

## Product review
A removed workflow label does not erase existing translation progress. Empty
values remain untranslated regardless of their retained status. Zero keys means
zero percent, not NaN or100. Counts checked against exact known main fixtures.
No production/schema/UI changes. Coverage22 FULL/7 PARTIAL/1 MISSING/defaultOFF.

## Designer review
Fresh local480x900 actor/task report fixture inspected: zero-key progress remains
readable, full actor IDs and group/user/null task rows fit. Existing progress
horizontal scroll retained. This image is not removed-status proof; actualPGHTTP
fixtures establish those counts. No UI changes.

## Security review
Existing authenticated project/branch report scope unchanged. Ephemeral local
fixture mutations only. No external accounts or private recipient disclosures.
No new execution authority or authorization/snapshot atomicity claim.

## QA/integration review
Reports54->57: removed filled status count, removed empty-row status exclusion,
zero-key branch finite zero percent/all-locale totals. API262/31 and web146/9
uncached unchanged.43 unique integration/config legs in12 fully completed green
batches, individual/inner/outerRC0. Sync644/browser212/builds/reaper4/docs4/138routes
allgreen. No failures/startupissues/timeouts/interruption or targetednegative
control this slice. Web562.75kBvs500warning remains. NativeSTAGED116+128=244total/
242unique PG55534innerouter0/checkpointremoved,NOTuninterrupted. No app/test changes
after native. No parity or snapshot consistency claim.
