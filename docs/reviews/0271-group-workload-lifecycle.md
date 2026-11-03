# 0271 - Group workload membership and lifecycle fixtures

## Developer review
Test-only existing workload fixture now assigns two actual group members, checked
in PostgreSQL. Separate lifecycle group renamed and deleted via normal API after
one group task created. Compare reports before/after committed changes.

## Product review
Group workload counts tasks, not group members. Rename changes label but not ID,
count or total. Deletion moves exactly one task into unassigned without changing
total; former group row disappears and open counts reconcile. Coverage22 FULL/
7 PARTIAL/1 MISSING/defaultOFF unchanged. No production changes.

## Designer review
No UI changes. Fresh480x900 local report fixture inspected: full actor IDs and
group/user/nulltaskrows readable, existing progress horizontal scroll retained.
Image not rename/delete proof; actualHTTP/PG fixtures establish those effects.

## Security review
Normal owner API group operations in ephemeral database only. No external accounts
or recipients. Sequential committed changes, not concurrent deletion/assignment
race evidence. Existing authorization unchanged.

## QA/integration review
Reports111->114: actualtwo-memberfixturecheck,renamepreservesidentity/count/total,
deleteunassignsonetask/excludesoldbucket/reconcilesopenstatuses. Supersedes prior
vacuous no-membership-expansion fixture, which used an empty group. API265/31/
web146/9uncachedunchanged.43uniquelegs/12completedgreenbatchesindividualinnerouter0.
Sync644/browser212/builds/reaper4/docs4/138routes0. No failures/startup/timeouts/
interruption/targetednegativecontrol. Web562.75kBvs500warning. NativeSTAGED116+128=
244total/242unique PG55534innerouter0/checkpointremoved,NOTuninterrupted.
Noapp/testchangesafter native.
