# 0263 - Usage top-five ranking contract

## Developer review
Test-only dedicated project isolates ranking from earlier event fixtures. Seven
same-name actors each have two events. Expected top IDs are independently sorted
and sliced to five; HTTP response must match exact IDs, names and counts. Second
read proves stable cutoff under unchanged fixture state. No production changes.

## Product review
Top actors means five, not everyone. Eight null-actor events remain in total22 and
daily totals but never enter the ranking. A future-only actor with nine events
cannot displace actual tied actors. Shared key name counts once. Display names do
not collapse identities. No coverage change:22 FULL/7 PARTIAL/1 MISSING/defaultOFF.

## Designer review
No UI changes. Fresh480x900 local actor/task fixture inspected: separate full IDs
and group/user/null rows readable, existing progress horizontal scroll retained.
The screenshot shows the existing two-actor UI, not seven-actor cutoff proof.
Actual PostgreSQL HTTP tests establish cutoff/null/future behavior.

## Security review
Fixture users have non-login password markers and exist only in ephemeral local
PostgreSQL. No external accounts, real recipients or secrets. Future timestamps
cannot inflate rank in this fixture. Existing authorization unchanged. No atomic
report snapshot, broader null-identity confidentiality or new permissions claim.

## QA/integration review
Reports50->54: seven tied same-name IDs cutoff, null events included totals/days
not ranking, future actor excluded plus activeKeys1, repeated stable read. API262/
31, web146/9 unchanged uncached.43 unique integration/config legs in12 completed
batches, individual/inner/outerRC0. Sync644/browser212/builds/reaper4/docs4/138routes
allgreen. No failures/startupissues/timeouts/interruption or targeted negative
control this slice. Web562.75kBvs500warning remains. NativeSTAGED116+128=244total/
242unique PG55534innerouter0/checkpointremoved,NOTuninterrupted. No app/test changes
after native. No performance benchmark or parity claim.
