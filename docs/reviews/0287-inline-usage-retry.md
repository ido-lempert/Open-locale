# 0287 - Inline usage retry

## Developer review
Failedusage shows explicit Retryusage button invoking existing fencedloadUsage.
Retains selecteddays, clears olderror/figures whilepending, no taskrefresh.
Existing generation/project/destroyfences reused. NoAPI/query/schema change.
Actualbrowser failure7/retry7 proves exactbounds and unchangedtaskcutoff.

## Product review
Recover usage without wholepage reload or losing current taskdashboard. Fixed
copy allows retryselectedwindow or reload; no automaticretry. Coverage22FULL/
7PARTIAL/1MISSING/defaultOFF unchanged; no remote/baseline/worker changes.

## Designer review
Fresh480x989fullpage inspected failurestate: selected7days, fixederror, visible
Retryusage button and alltaskrows readable. Ordinaryverticalscroll, existing
progresshorizontal scroll unchanged. No changedcopy clipping.

## Security review
Userinitiated existingreadonly APIcall, no newendpoint/fields/audiences/permissions.
Browserassertion hides rawprivate-retry-detail. Existingrequestfences retained.
Ownerrequest rechecked; no registration/scopespansion/spend/licensechoice.
No memoryerasure claim.

## QA/integration review
Browser234->236 selectedfailure/inlineclickrecovery; API265/31/web155/9/reports118
uncached0.43uniqueintegration/configlegs in13completedgreenbatches inner/outer0;
sync644/builds/reaper4/docs4/138routes0. No failures/startup/timeouts/interruption.
NativeSTAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved,
NOTuninterrupted; noapp/testchangesafter native, finalbrowser236rerun0.
Bundlewarning566.51kBvs500(previous566.33). Dockerstaticonly, no daemonclaim.
