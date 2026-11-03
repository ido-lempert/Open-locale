# 0255 - Branch report loading and safe failure guidance

## Developer pass
Explicit branchLoading signal replaces implicit missing-report loading. Fetchstart
and projectload set busy;only current generation success/failure ends it. Main
aria-busy combines branch/dashboard loading. Fixed progress/quality failure text
replaces raw server message. Pair publication/clear/fence logic unchanged.

## Product pass
Progress/quality unavailable is not zero or a partialreport. Guidance asks branch
selection again or page reload,no automatic retry. Usage/tasks stay independent.
One branch failure hides both branchfigures,as186;separate reads not one snapshot.
No API/server change,coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
Final480x900local quality503fixture inspected:full fixed unavailable/retryguidance,
no progressfigures,empty Qualityheading,usage/tasksretained. No rawdetail/loading
left after completion. Existing layout unchanged,no horizontaloverflow visible.
Mainaria-busy/status express current load,no focus movement added.

## Security pass
Raw progress/quality errors no longer retained/rendered. Static text prevents
server detail echo. Stale request cannot end newer loading or set olderror.
No HTTPabort/private-memoryerasure/responseauthentication claim. No new authority
or targeted negative-control claim.

## QA/integration pass
Web144->146/9(+2loadingfencecases;existingcurrentfailureassertfixed),API248/30,
uncachedRC0. Browser208->209(+1quality503fixedguidance/no partial/rawdetail),initial/
finalRC0.43unique integration/configlegs in12completedgreenbatches,individual/
outerRC0,sync644,bothbuilds/reaper4/docs4/138routesRC0. No failures/startupissues/
timeouts/interruption189. Webbudget562.48kBvs500warningpersists. NativeSTAGED
116+128=244total/242unique,PG55534,inner/outerRC0,checkpointremoved,not uninterrupted.
No app/testchangesafternative;uncachedAPI/webunits/browser209reran,then docsonly.
No external delivery/exactly-once claim.
