# 0286 - Usage window race browser proof

## Developer review
Test-only real Angular/API request interception: hold90day request, then request
30daywindow and complete it, release90 and confirm latestselection/responsebounds
remain. Existing7daypicker check retained. Noapp/API/query/schema change.

## Product review
A slow previous selection must not relabel or replace newestwindow. Pending90
clears oldusagefigures and announcesloading; completed30stays after late90, task
cutoffunchanged. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no remote/
baseline/worker changes. Not a synchronizedsnapshot guarantee.

## Designer review
Fresh480x1152fullpage inspected:30daypicker/heading agree afterlate90, exactwindow
and taskrows readable with ordinaryverticalscroll. Existingprogresshorizontal
scroll unchanged. Screenshot captures completedlatestwindow, not pendingrequest.

## Security review
Fixture holds only existinglocalAPIrequest, no externalprovider calls. No new
permissions/audiences/datafields. Existing requestfence behavior verified at real
browser boundary, not memoryerasure or authorizationatomicity. Ownerrequest
checked, no registration/scopespansion/spend/licensechoice.

## QA/integration review
Browser232->234 pendingwindow/latecompletion checks; reports118/API265/31/web155/9
uncached0.43uniqueintegration/configlegs in13completedgreenbatches inner/outer0;
sync644/builds/reaper4/docs4/138routes0. No failures/startup/timeouts/interruption.
NativeSTAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved,
NOTuninterrupted; noapp/testchangesafter native, finalbrowser234rerun0.
Bundlewarning unchanged566.33kBvs500. Dockerstaticonly, no daemonclaim.
