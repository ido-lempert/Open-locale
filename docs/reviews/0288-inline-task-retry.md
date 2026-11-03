# 0288 - Inline task report retry

## Developer review
Extracted taskloader with requestgeneration plus project/destroyfences. Failedtask
button invokes taskonlyreload, clears error/figures whilepending, no usagerefresh.
Dashboardinitialization starts bothloaders. Unitlateoldsuccess/loading and error
fences; existingproject/destroy tests retained. NoAPI/query/schema change.

## Product review
Recover taskdashboard without losing selectedusagewindow/exactcutoff. Actual
browser task503 then real Retrytasksclick recovers, no staleerror/button and usage
windowtextunchanged. Explicitretry, no automaticretry guarantee. Coverage22FULL/
7PARTIAL/1MISSING/defaultOFF unchanged; no remote/baseline/worker changes.

## Designer review
Fresh480x900fullpage inspected: fixedtaskerror/Retrytasks button visible below
successfulusage. No changedcopy clipping. Existingprogresshorizontal scroll
unchanged. Failurecapture uses actualinterceptedlocalrequest, not externaloutage.

## Security review
Userinitiatedreadonly request, no newendpoints/fields/permissions/audiences.
Fixederrorcopy/rawdetailabsent, taskgeneration fences stale completion/error/
finally in addition to project/destroy. Ownerrequestrechecked; no registration/
scopespansion/spend/licensechoice or memoryerasure claim.

## QA/integration review
Web155->157/9 taskretryfences, browser236->237 usagewindowunchanged on inline retry;
existingtaskrecovery changed from reload to realbuttonclick. Reports118/API265/31
uncached0.43uniqueintegration/configlegs in13completedgreenbatches inner/outer0;
sync644/builds/reaper4/docs4/138routes0. No failures/startup/timeouts/interruption.
NativeSTAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved,
NOTuninterrupted; noapp/testchangesafter native, finalbrowser237rerun0.
Bundlewarning566.69kBvs500(previous566.51). Dockerstaticonly, no daemonclaim.
