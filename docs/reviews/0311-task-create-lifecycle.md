# 0311 - Task create lifecycle

## Developer review
Create now guards pending/destroy, captures project visit and request destination,
and fences success/error/finally. New project resets visible pending state. Current
success clears draft and refreshes; failure keeps draft. Four units cover duplicate,
current success/failure, oldvisit success and destroy failure. No API/query/schema.

## Product review
Duplicate clicks while pending do not create extra tasks. Fixed failure asks to
inspect list before trying again because network failure can be ambiguous. No
automatic retry, server idempotency or cancellation claim: old in-flight request may
finish on original project, but must not clear a new project's draft or list.
Update/delete lifecycle remains separate work.

## Designer review
Fresh480x900 final route-fence capture inspected: new project unsaved title remains,
create enabled/current row and controls fit. Pending form busy/status and disabled
submit tested in real browser. No redesign.

## Security review
Request destination fixed at initiation; response callbacks require current visit
and nondestroyed component. Fixed create error omits raw exception. Real held POST
released after route switch persists once only in old project. Own isolated fixtures;
no credential scope/spend/license/provider change. Owner upload authority recovered.

## QA/integration review
API265/31/web204->208/12 uncached0/builds0. Tasksbrowser11->13 duplicate pending/
routefenced actual creation; tasks80/Activity22/reports118/sync644/syncbrowser239/QA14
unchanged.46uniqueintegration/configlegs inner/outer0; reaper4/docs4/138routes0. No
failures/timeouts/interruption. Native STAGED116+128=244total/242unique PG55534 inner/
outer0/checkpointremoved, not uninterrupted. No app/test edits after native.
Bundle575.89kBvs500warning(previous575.39). Docker static only/no daemon claim.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no remote/baselineadvance/
accepted sync/enabledworker. Existing report snapshot/window caveats unchanged.
