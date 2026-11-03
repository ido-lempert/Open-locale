# 0297 - Explicit QA refresh

## Developer review
Successful/pending QA toolbar now has Run checks again, disabled while pending,
reusing existing fenced read-only loader. Error-only retry remains separate.
Actual real translation update followed by pointer refresh verifies old findings
clear while pending and changed result replaces them. No API/query/schema change.

## Product review
Users can recheck after edits without toggling locale/reloading. Actual plural
placeholder repair reduces five findings to three, selected Hebrew retained,
metadata not reloaded. No live-update/automatic polling/quality certification claim.

## Designer review
Fresh480x900 inspected: locale/Run checks again/count fit toolbar; refreshed three
findings readable. Existing table horizontal scroll remains, all columns not
simultaneously visible at480. Disabled pending button prevents repeated clicks.

## Security review
Explicit read-only action with same endpoint/permissions/request fences. Test writes
only own isolated local fixture. No account/scope/spend/license change. Owner original
and todo rechecked. No network-abort/memory-erasure claim.

## QA/integration review
QA12->14 actual heldrefresh pending controls and real changed-findings/locale/no-
metadata-read proof. API265/31/web176/11/reports118/sync644/syncbrowser239/activity8
unchanged.45uniqueintegration/config legs completed inner/outer0. Two combinedshell
120s interruptions: D completed0 then E during incontext-edit (ota36/incontext41
inner0); F completed0 then G during SAMLbrowser (OIDC49inner0). No assertion FAIL.
Verified PG55468pid5238 / PG55478pid7315 zombies/TCP111 closed, matching stale
sockets removed; owned Chrome5300/7443 groups stopped. E36/41/51 and G49/61
isolated reruns inner/outer0. No app fixes for interruptions.
Builds/reaper4/docs4/138routes0. Native STAGED116+128=244total/242unique PG55534
inner/outer0/checkpointremoved, not uninterrupted. No app/test edits after native;
finalQA14 rerun0. Bundle571.60kBvs500warning(previous571.25). Docker static only/
no daemon claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged;
no remote/baseline advance/accepted sync/enabledworker.
