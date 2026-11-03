# 0284 - Independent project dashboard completion

## Developer review
Usage/tasks now publish each result or fixed error independently, with separate
loading signals. Aggregate main busy stays true while either pending. Existing
project/destroy fences cover each result/error/finally mutation. NoAPI/query/
schema change. Two held-sibling unit cases plus actualheldusagebrowser. Existing
cross-project/destroy/error tests remain green.

## Product review
Completed task data should not wait for a slow usage request or vice versa.
Each section has its own loading copy. No claim of synchronized snapshots,
authorization freshness or automatic retry. Coverage22FULL/7PARTIAL/1MISSING/
defaultOFF unchanged; no remote sync/baseline/worker changes.

## Designer review
Fresh480x900fullpage inspected: usage loading message and completed task summary/
cutoff/workload readable together. No fake usage zeroes. Existingprogresshorizontal
scroll unchanged; no changedcopy clipping.

## Security review
Each separate fulfillment/rejection/finally checks project/destroy scope. Fixed
error copy remains, no rawserverdetails/newfields/audiences/permissions. Original
ownerrequest rechecked; no registration/scopespansion/spend/licensechoice.
No memory-erasure claim.

## QA/integration review
Web151->153/9 held-sibling units, browser230->231 actualheldusage/task-visible
proof. Initialweb152PASS/1FAIL: earlier heldbranchlisttest checked aggregatebusy
false after exactly2microtasks, before newfinally chain settled. Changed only
fixtureflush to8microtasks, allassertionsretained,153green. No appfix for failure.
Reports118/API265/31uncached0;43uniqueintegration/configlegs in13completedgreen
batches inner/outer0;sync644/builds/reaper4/docs4/138routes0. No startup/timeouts/
interruptions. NativeSTAGED116+128=244total/242unique PG55534 inner/outer0/
checkpointremoved, NOTuninterrupted; noapp/testchangesafter native, finalbrowser231
rerun0. Bundlewarning565.43kBvs500(previous565.02). Dockerstaticonly, no daemonclaim.
