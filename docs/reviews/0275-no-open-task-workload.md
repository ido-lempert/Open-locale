# 0275 - Empty open task workload

## Developer review
Render explicit No open tasks when perAssignee empty. No fake assignee/table.
Actual browser fixtures zero tasks then oneDONEtask, removed before existing
assignment identity fixtures. No API/query/schema changes.

## Product review
No open work differs from no tasks at all. DONE-only total1 remains visible with
DONE1 while workload says no open tasks. Coverage22 FULL/7 PARTIAL/1 MISSING/
defaultOFF unchanged. Existing static snapshot caveats retained.

## Designer review
Fresh480x900 fullpage inspected: DONE-only summary and No open tasks message
readable/fits with usage empty states/window above. No fabricated assignee rows.
Existing progress horizontal scroll unchanged.

## Security review
Static fixed message, no additional fields/audiences/permissions. Existing
interpolation and authorization unchanged. No memory/cache erasure claim.

## QA/integration review
Browser217->219: zero-taskexplicitmessage/noassigneetable;DONE-onlytotal1/DONE1/
emptyworkload. Existingidentityfixturesgreen aftercleanup. Reports114/API265/31/
web146/9uncached unchanged.43uniquelegs/12completedgreenbatchesindividualinnerouter0;
sync644/builds/reaper4/docs4/138routes0. No failures/startup/timeouts/interruption/
negativecontrol. WebwarningNOW563.45kBvs500(was563.34). NativeSTAGED116+128=244total/
242unique PG55534innerouter0/checkpointremoved,NOTuninterrupted. Noapp/testchanges
after native;browser219reranafterward.
