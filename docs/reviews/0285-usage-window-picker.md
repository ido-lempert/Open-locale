# 0285 - Usage window picker

## Developer review
Usage picker offers7/30/90days through existing days API parameter. Default30 and
projectreset retained. loadUsage clears priorfigures and captures window/project/
requestgeneration; late sameproject success/error/finally ignored. Task figures
not refetched. Existing project/destroy guards apply. Unit stale success/loading
and stale error cases. NoAPI/query/schema change.

## Product review
User can inspect short or longer activity windows without losing task dashboard.
Actualbrowser selects7days, confirms exact7dayresponsebounds and unchangedtask
cutoff. No synchronizedsnapshot or authorizationfreshness claim. Coverage22FULL/
7PARTIAL/1MISSING/defaultOFF unchanged, no remote/baseline/worker changes.

## Designer review
Fresh480x1152fullpage inspected: labeled fullwidthpicker shows7days, heading agrees,
ISOwindow wraps, taskrows readable with ordinaryverticalscroll. Existing progress
horizontal scroll unchanged. No changedcopy clipping.

## Security review
Fixed numeric choices use existing validatedserverparameter. No newfields,
permissions,audiences or secrets. Requestgeneration fences latevalues/errors and
loadingmutations in addition to existing project/destroyfences. Ownerrequest
rechecked; no accountregistration/scopespansion/spend/licensechoice.

## QA/integration review
Web153->155/9 unitwindowfences; browser231->232 actual7daypicker/exactbounds/
unchangedtaskcutoff. Reports118/API265/31uncached0;43uniqueintegration/configlegs
in13completedgreenbatches inner/outer0;sync644/builds/reaper4/docs4/138routes0.
No failures/startup/timeouts/interruption. NativeSTAGED116+128=244total/242unique
PG55534 inner/outer0/checkpointremoved, NOTuninterrupted; noapp/testchangesafter
native, finalbrowser232rerun0. Bundlewarning566.33kBvs500(previous565.43).
Dockerstaticonly, no daemonclaim.
