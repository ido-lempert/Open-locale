# 0253 - Report project-route response fencing

## Developer pass
Subscribe to route paramMap,not snapshot-only initialization. Each project change
increments independent project generation plus branch generation,clears all report/
branch state,resets main,and fences branch-list response before fetching project
reports. Usage/task requests capture same project and commit pair only for current
project generation. Destroy unsubscribes and fences both scopes. No server change.

## Product pass
Same-component project navigation now loads new project figures instead of keeping
old project data. Late old dashboards cannot replace new values. Branch changes
still use186fence independently. Usage/tasks failure remains null as before;new
failure presentation is outside this slice. Pair is separate HTTP snapshots,not
one database snapshot. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
Final480x900local new-project report screenshot inspected:0keys/main,emptybase
progress,0quality/usage/tasks,no old figures. Existing table has own horizontal
scroll,unchanged layout. Editor link points to new project. Screenshot alone does
not prove lifecycle fencing;actual held oldusage browser assertion does.

## Security pass
Clear old project state before asynchronous branch-list load. Late old project
responses cannot populate new page. No HTTP abort/private-memory erasure claim.
No new API/grant/account/disclosure. No targeted negative-control claim. Empty
project ID or denied project continues through normal authenticated API checks.

## QA/integration pass
Web137->141/9(+4route/list/dashboard/destroycases),API248/30unchanged,uncachedRC0.
Browser205->207(+2actualsamecomponentprojectnavigation/lateoldusagepair),initial/
finalRC0.43unique integration/configlegs in12completedgreenbatches,individual/
outerRC0,sync644,bothbuilds,reaper4,docs4/138routesRC0. No failures/startupissues/
timeouts/interruption187. Existingwebbudget560.96kBvs500warning. NativeSTAGED
116+128=244total/242unique,PG55534,inner/outerRC0,checkpointremoved,not uninterrupted.
No app/testchangesafternative;uncachedAPI/webunits and browser207reran,then docs
only. No external delivery/exactly-once claim.
