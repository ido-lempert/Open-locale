# 0281 - Independent report and branch-list loading

## Developer review
Start branch list, default-main progress/quality pair, and project dashboards
concurrently. Branch-list publication retains project-generation/destroy fence;
existing branch-pair/dashboard fences unchanged. Empty branch list shows main
option instead of blank selector. Unit holds list while reports finish; existing
cross-project/destroy tests remain green. No API/query/schema change.

## Product review
Slow branch-list should not hide valid main reports or project-wide dashboards.
Actual held-list browser shows completed main progress/quality and usage/tasks.
No retry, whole-report snapshot or authorization freshness claim. Branch discovery
failure handling remains existing empty-list fallback. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no remote sync/baseline/worker/account changes.

## Designer review
Fresh480x962 fullpage inspected while branch list held: main remains selected,
progress/quality/usage/tasks readable with ordinary verticalscroll. Existing
progress horizontal scroll unchanged. Main fallback avoids empty selector.

## Security review
Only request scheduling and fallback option changed. No new endpoint, fields,
permissions, audiences or secret handling. Late old-project branch list cannot
publish into new project. Destroy fences retained. Owner request rechecked.
No registration, token scope expansion, spend or license choice.

## QA/integration review
Web146->147/9 unit held-list test; browser225->226 actual held-list proof. Reports118/
API265/31 uncached0. All43unique integration/configlegs in13completedgreenbatches
inner/outer0;sync644/builds/reaper4/docs4/138routes0. No assertion failures/startup
problems/timeouts/interruption this slice. Existing jsdom scrollTo diagnostics in
web tests remain non-failing; all147passed. Native STAGED116+128=244total/242unique
PG55534 inner/outer0/checkpointremoved, NOTuninterrupted. Noapp/testchangesafter
native; finalbrowser226rerun0. Bundlewarning564.25kBvs500(previous564.11).
Dockerstaticonly, no daemon claim.
