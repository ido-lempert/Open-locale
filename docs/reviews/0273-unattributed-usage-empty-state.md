# 0273 - Empty attributed actor ranking

## Developer review
Angular empty branch renders one table row when topActors is empty, without
inventing actor IDs/counts. No API/query/schema changes. Actual browser fixture
inserts one null-actor event then removes it before existing two-actor checks.

## Product review
No attributed actors does not mean no activity. UI explicitly says No attributed
actors in this window while keeping total1/activeKeys0. Existing ranking limit,
UTC window and snapshot caveat retained. Coverage22 FULL/7 PARTIAL/1 MISSING/
defaultOFF unchanged.

## Designer review
Fresh480x900 fullpage inspected: null-only event action/count, explicit empty
actor row, captured window and zero-task summary fit/readable. Existing progress
horizontal scroll unchanged. No fabricated person/name row.

## Security review
No new fields, permissions or recipients. Interpolation remains escaped. Empty
ranking message does not reveal additional actor information or claim events were
anonymous by design. No memory/cache erasure or snapshot authorization claim.

## QA/integration review
Browser214->215 actualnull-onlyevent/total1/keys0/emptyrankingmessage/oneemptyrow;
existing two-actor rendering stillgreen afterfixturecleanup. Reports114/API265/31/
web146/9uncached unchanged.43uniquelegs/12completedgreenbatches individualinnerouter0;
sync644/builds/reaper4/docs4/138routes0. No failures/startup/timeouts/interruption/
negativecontrol. WebwarningNOW563.20kBvs500 (was563.03). NativeSTAGED116+128=244total/
242unique PG55534innerouter0/checkpointremoved,NOTuninterrupted. Noapp/testchanges
after native;browser215reranafterward generatedfinalimage.
