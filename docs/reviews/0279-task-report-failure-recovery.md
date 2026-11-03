# 0279 - Task report failure and recovery browser proof

## Developer review
Test-only request interception rejects exactly tasks report with503/private-detail
body. Actual Angular/HTTP sibling requests continue. Assert fixed guidance and
absence of task table/window/empty-state, plus completed loading state. Remove
interception and reload, assert task window/zero summary/empty workload restored
with no stale failure. No app/API/query/schema change.

## Product review
Unavailable task data must not resemble a zero-task result. Successful usage,
progress and quality remain visible. Recovery requires explicit reload as current
copy says; no automatic retry promise. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF
unchanged. No remote sync/baseline/worker or account changes.

## Designer review
Fresh480x900 fullpage inspected: task error readable below preserved successful
sections; no stale task figures or cutoff. No changed UI/style. Existing progress
horizontal scroll unchanged. Screenshot captures intercepted failure, not outage
of production/external service.

## Security review
Assert private-task-detail is absent from page; fixed text only, no raw server
message displayed. No credentials or new audiences. Owner authority rechecked,
no registration/scope/spend/license work. This is display behavior proof, not
client-memory erasure or authorization atomicity.

## QA/integration review
Browser222->224 with actual task503/recovery checks. Reports118/API265/31/web146/9
uncached0,43unique integration/configlegs in13completedgreenbatches inner/outer0;
sync644/builds/reaper4/docs4/138routes0. Initial browser shell exit1 was trailing
grep finding zero FAIL lines; runner/browser/batch all0, final isolated rerun0.
Prior wake had3runtimeactivationfailures before commands, no code/write; this wake
recovered. No test assertion failure/startup problem/timeout/interruption this wake.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved,
NOT uninterrupted. No app/testchangesafter native, finalbrowser224rerun0.
Bundlewarning unchanged563.94kBvs500; Dockerstaticonly, no daemon claim.
