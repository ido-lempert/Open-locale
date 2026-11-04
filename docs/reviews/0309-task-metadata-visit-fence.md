# 0309 - Task metadata visit fence

## Developer review
Added project visit generation to member/group/key callbacks and destroy. Comparing
project ID alone did not protect A B A visits. Four units cover each metadata list
late success and member late failure. Actual captured old key bytes released after
new options settle cannot remove newly created key. No API/query/schema change.

## Product review
Task form options stay current for the latest visit. This does not add metadata
failure/retry states or mutation lifecycle guarantees. Existing task filter storage
and list request fences unchanged.

## Designer review
Fresh480x900 repeatedproject capture inspected: fresh.second.visit key remains
visible in existing scrollable key selector, controls/form fit. No UI change.

## Security review
Visit token prevents old callbacks replacing current options even when sameproject
is revisited. Real old bytes exclude new key, making proof discriminating. Ownlocal
fixtures only; no credential scope/spend/license/provider action. Owner upload
permission recovered before commit.

## QA/integration review
API265/31/web198->202/12 uncached0/builds0. Tasksbrowser8->9; tasks80/Activity22/
reports118/sync644/syncbrowser239/QA14 unchanged.46uniqueintegration/configlegs inner/
outer0; reaper4/docs4/138routes0. Final native STAGED116+128=244total/242unique
PG55534 inner/outer0/checkpointremoved, not uninterrupted. No app/test edits after
final native. Bundle575.00kBvs500warning(previous574.87). Docker static only/no daemon
claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no remote/baselineadvance/
accepted sync/enabledworker. Existing report snapshot/window caveats unchanged.

Chronology: first native secondstage aborted on setDepends row dereference during
refetch after optimistic selection. Harness-only fix awaited PATCH then networkidle;
second attempt timed out at networkidle. Replaced globalidle with exact subsequent
GET response plus settledmain. Fresh first116/second128 outer0. No assertion removed;
application unchanged after initial fix. Config10 rerun after final harness edit.
