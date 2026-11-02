# 0252 - Report branch response fencing

## Developer pass
Progress/quality requests capture same project/branch before awaits and commit a
complete pair only. Each fetch clears old branch figures/statuscolumns immediately.
Generation/destroy guard ignores late success/error and blocks new fetch after
destroy. No backend change. Usage/tasks remain project-level and independent;
reused-component project-route handling is not changed by this slice.

## Product pass
Changing branch must not leave old branch counts labeled with new selection or
let an older request overwrite newest results. Current pair failure leaves figures
empty with error rather than partial progress. No request cancellation/snapshot
consistency guarantee;two HTTP reads remain distinct server snapshots. Coverage
22FULL/7PARTIAL/1MISSING/defaultOFF unchanged. No repository effects changed.

## Designer pass
Final480x900local report screenshot inspected after late held response:mainselected,
progress and quality bothmain,usage/tasks visible. Existing table scroll clips
rightmost columns inside its container,not wholepage;unchanged visual layout.
Image alone does not prove fencing;held-response browser assertion does.

## Security pass
Late branch success/error cannot overwrite newest branch figures. Destroy fencing
is state-update prevention,not HTTP abort or private-memory erasure. No new API,
account,grant or disclosure. No targeted negative-control claim. Existing separate
usage/tasks lifecycle and project-route behavior remain outside this change.

## QA/integration pass
Web132/8->137/9(+5clear/capture/overlap/error/destroycases),API248/30unchanged,
uncachedRC0. Browser203->205(+2actualheldqualitybranchswitch):previousfiguresclear,
newmainpairwins after olderbranchrelease. Final fixture registers responsewait
before release to avoid race,then checks quality branch too;finalRC0.
43unique integration/configlegs in12completedgreenbatches,individual/outerRC0,
sync644,bothbuilds,reaper4,docs4/138routesRC0. No failures/startup/timeouts/interruption
186. Existing webbudget560.39kBvs500kBwarning. Native STAGED116+128=244total/242unique,
PG55534,inner/outerRC0,checkpointremoved,not uninterrupted. No app/testchangesafter
native;uncachedAPI/webunits reran,then docs only. No external delivery/exactly-once
claim.
