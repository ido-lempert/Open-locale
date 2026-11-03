# 0290 - Inline branch-list retry

## Developer review
Extracted branch discovery loader with request generation plus project/destroy
fences. Same-project stale success/error/finally cannot overwrite newer retry.
Existing project/destroy and independent main-report startup tests retained.
Retry leaves selected branch and existing report/dashboard objects unchanged.
No API/query/schema change.

## Product review
Error-only Retry branch list replaces forced reload, allowing discovery recovery
without losing successful reports or exact dashboard cutoffs. Actual browser503
then real button click restores options, preserves main/progress/usage/task text,
removes stale error/button. No automatic retry promise. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no remote/baseline/accepted sync/worker change.

## Designer review
Fresh480x1130 fullpage inspected: failure copy and button fit above retained main
figures and project dashboards. Progress table keeps existing horizontal scroll;
no changed copy clipping. Initial screenshot read failed transient TLS transport,
retry displayed actual image. Failure is intercepted local503, not external outage.

## Security review
Fixed nonprivate error text, same read-only endpoint/permissions, explicit click.
Independent generation protects same-project retry; project/destroy guards remain.
User request/todo rechecked. No registration/token scope/spend/license change.

## QA/integration review
Web158->161/9 adds three discovery retry units; API265/31, reports118, sync644.
Browser238->239 adds unchanged report/cutoff assertion; existing discovery recovery
now real retry click instead of reload.43 unique integration/config legs across11
completed green batches, all inner/outer0. No assertion failure. Final browser
rerun shell interrupted near end after report assertions; owned Nx8685/Chrome8741
groups stopped, PG55479 pid8622 verified zombie/TCP111 closed, matching stale
sockets removed. Isolated239 rerun inner/outer0; no app fix for interruption.
Builds/reaper4/docs4/138routes0. Native STAGED116+128=244total/242unique PG55534
inner/outer0/checkpoint removed, not uninterrupted. No app/test changes after
native; final browser239 rerun0. Bundle567.17kBvs500warning(previous566.87).
Docker static only, no daemon claim. UI pair atomicity is not DB snapshot;
existing separate-read/window caveats retained.
