# 0282 - Branch discovery failure guidance

## Developer review
Branch-list rejection sets a scoped boolean instead of silently falling back.
Reset on project load; current-project/destroy guards apply to success and failure.
Defaultmain option remains available; reports and projectdashboards independent.
Unit current rejection/reload and old-project/destroy rejection fences. NoAPI/
query/schema change.

## Product review
A failed list is not evidence main is the only branch. Fixed message states only
main is offered and reload can try loading other branches. Actual browser503
retains main figures/dashboards and successful reload restores second option,
removing notice. No automatic retry promise. Coverage22FULL/7PARTIAL/1MISSING/
defaultOFF unchanged; no remote sync/baseline/worker changes.

## Designer review
Fresh480x1013fullpage inspected: alert readable at top, main selector visible,
progress/quality/usage/tasks retained with normalverticalscroll. Existing progress
horizontal scroll unchanged. No changed text clipping.

## Security review
Fixed text only, raw private-branch-list-detail absent in actual browser page.
No new audiences, datafields or permissions. Late untrusted server error cannot
cross project/destroy fence. Originalowner request checked; no accountregistration,
token scope expansion, spend or license choice. No memory-erasure claim.

## QA/integration review
Web147->150/9 unit tests; browser226->228 actuallist503/reloadrecovery. Reports118/
API265/31 uncached0. All43uniqueintegration/configlegs in13completedgreenbatches
inner/outer0;sync644/builds/reaper4/docs4/138routes0. No failures/startup problems/
timeouts/interruption thisslice. NativeSTAGED116+128=244total/242unique PG55534
inner/outer0/checkpointremoved, NOTuninterrupted. Noapp/testchangesafter native;
finalbrowser228rerun0. Bundlewarning564.62kBvs500(previous564.25). Dockerstaticonly,
no daemon execution claim.
