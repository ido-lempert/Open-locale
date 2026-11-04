# 0307 - Tasks list recovery

## Developer review
List reads now clear stale rows before pending, independently track fixed list
failure, and retry current filters. Existing sequence/project reset keeps latest
response authoritative; destroy invalidates pending reads and suppresses new reads.
Metadata callbacks also check destroy. Three new units cover retry/filter retention,
mutation-error independence, late failure and destroy. No API/query/schema change.

## Product review
Pending/failure no longer shows tasks from an earlier filter or claims empty success.
Explicit retry reruns only the list, keeps selected filters and does not clear a
separate mutation failure. Create/update/delete behavior unchanged. Metadata errors,
repeated-project metadata races and mutation lifecycle guards remain separate work.

## Designer review
Fresh480x900 failure/recovered captures inspected after final browser rerun. Fixed
error/retry below existing create form readable; recovered task and selected OPEN
filter fit without document overflow. Existing form reflows based on task options;
no redesign claim.

## Security review
Raw list error omitted, fixed guidance only. Destroyed component cannot accept list
results or start another read. Text binding and server authorization unchanged.
Own isolated realAPI/PG fixtures only; no credential scope/spend/license/provider
change. Mutation errors intentionally remain on existing separate path.

## QA/integration review
API265/31/web195->198/12 uncached0/builds0. NewTasks browser5 checks actual persisted
row,503/fixed failure/no stale or empty-success, heldretry/filter, recovery,narrowfit.
Tasks80/Activity22/reports118/sync644/syncbrowser239/QA14 unchanged.46uniqueintegration/
configlegs inner/outer0; reaper4/docs4/138routes0. No failures/timeouts/interruption.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved,
not uninterrupted. No app/test edits after native. Bundle574.87kBvs500warning
(previous574.03). Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no remote/baseline advance/accepted sync/enabledworker.
Existing report snapshot/window caveats unchanged.
