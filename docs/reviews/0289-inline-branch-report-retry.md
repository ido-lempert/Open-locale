# 0289 - Inline branch report retry

## Developer review
Error-only button reuses existing pair fetch with generation/project/destroy fences,
clearing old figures/error/columns while pending. Both calls capture selected branch.
Added selected-feature retry unit preserving dashboard object identities; existing
late-success/error/loading and destroy tests retained. No API/query/schema change.

## Product review
Retry progress/quality without reloading project dashboards or losing selection.
Actual browser quality503 -> real retry click -> complete pair recovery; usage
window/task deadline text unchanged, error/button removed. This is explicit retry,
not automatic recovery. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
No remote write/baseline advance/accepted sync/enabled worker.

## Designer review
Fresh480x900 fullpage inspected: fixed error and Retry branch reports visible above
successful project dashboards. No changed copy clipping. Existing progress table
horizontal scroll unchanged. Failure capture uses intercepted local503, not an
external outage. No separate screenshot-delivery or parity claim.

## Security review
User-initiated read-only requests reuse same endpoints/permissions and fixed errors.
No raw private fault detail; stale pair completion still fenced. Owner request and
todo rechecked. No registration/token expansion/spend/license change.

## QA/integration review
Web157->158/9 selected-feature retry unit; API265/31/reports118/sync644 green.
Browser237->238 real retry plus unchanged dashboard cutoffs; recovery replaced full
reload.43 unique integration/config legs completed green across12 completed batches;
all recorded inner/outer0 except initial combined reports+sync shell and combined
webhooks+mt shell whose inner batches completed0 but outer timed out during next
suite. No assertion FAIL. Interrupted browser/automations rerun separately0 after
owned Nx cleanup and verifying PG55479 pid1486 / PG55470 pid4162 zombies, TCP111
closed, removing matching stale sockets. Webhooks/mt and reports/sync rerun for
completed outer evidence. No app fix for interruptions.
Native STAGED116+128=244total/242unique PG55534 inner/outer0, checkpoint removed,
not uninterrupted. No app/test edits after native. Finalbrowser238 rerun0.
Builds/reaper4/docs4/138routes0. Bundle566.87kB vs500warning(previous566.69).
Docker static only, no daemon claim. Pair publication is atomic UI, not DB snapshot;
project dashboards retain their separate-read/window caveats.
