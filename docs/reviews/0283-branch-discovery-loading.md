# 0283 - Separate branch discovery loading status

## Developer review
Scoped branchListLoading state starts with each project load and settles in
finally only for current live project. Selector aria-busy reflects list rather
than report requests. Separate status text does not block independent reports.
Unit held-list assertion plus old-completion/new-loading fence. Existing error,
project and destroy fences unchanged. NoAPI/query/schema change.

## Product review
Users can distinguish temporary mainfallback while listloading from completed
branch discovery or listfailure. Wording says reports available independently,
not that current report requests necessarily succeeded. Actualheldlistbrowser
shows finished reports while listloading and clears status on completion.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no remote/baseline/workerchange.

## Designer review
Fresh480x1013fullpage inspected: loadingstatus at top, mainselector visible,
progress/quality/usage/tasks remain readable with ordinaryverticalscroll.
Existingprogresshorizontal scroll unchanged; no changedcopy clipping.

## Security review
Fixedstatus only, no new endpoint/fields/permissions/audiences. Finally mutation
fenced against lateoldproject completion/destroy. Originalownerrequest rechecked.
No accountregistration/scopespansion/spend/licensechoice or memoryerasure claim.

## QA/integration review
Web150->151/9 unit checks; browser228->230 heldlistloading/settledstatus checks.
Reports118/API265/31uncached0. All43uniqueintegration/configlegs in13completedgreen
batches inner/outer0;sync644/builds/reaper4/docs4/138routes0. Transient runtime
failure between commands resumed after parentmessage; inspected tree/logs before
continuation, no interruptedwrites or testfailure. No assertion/startup/timeouts/
testinterruption. NativeSTAGED116+128=244total/242unique PG55534 inner/outer0/
checkpointremoved, NOTuninterrupted. Noapp/testchangesafter native; finalbrowser230
rerun0. Bundlewarning565.02kBvs500(previous564.62). Dockerstaticonly, no daemonclaim.
