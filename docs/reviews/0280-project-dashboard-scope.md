# 0280 - Explicit project dashboard scope

## Developer review
Static scope note says usage/tasks cover whole project; branch selector filters
progress/quality only. No API/query/schema change. Actual browser reuses existing
held-branch transition, compares entire project-dashboard text including captured
cutoffs while branch pair is loading. No extra branch reloads retained.
Report-only reload helper now waits for DOMcontentloaded plus aria-busy=false,
not generic networkidle0; existing selector/result/error checks retained.

## Product review
Avoid implying branch filter applies to task/usage aggregates. Project-wide scope
is explicit above those sections. No freshness or snapshot guarantee added.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no remote sync/baseline/
worker changes. No new user authority requirements.

## Designer review
Fresh480x900 fullpage inspected with held branch pair: scope note wraps readably,
usage/task summaries and cutoffs visible while progress/quality loading. Normal
vertical flow. Existing progress horizontal scroll unchanged. No clipping of
changed copy. Screenshot deliberately captures loading, not completed branch pair.

## Security review
Static text only, no new fields, permissions, audiences or credentials in diff.
Existing interpolation/fencing/error behavior unchanged. Original owner request
verified. No account registration, scope expansion, spend or license choice.

## QA/integration review
Browser224->225 full pass inner/outer0. Reports118/API265/31/web146/9 uncached0;
43unique integration/configlegs in13completedgreenbatches inner/outer0;
sync644/builds/reaper4/docs4/138routes0. Two initial120s browser interruptions,
no assertion failures: first added redundant branch reloads, second reused held
transition but still exceeded budget. Validated own Nx/Chrome groups before stop;
stale55479 socket removed only after recorded PID zombie and TCP111closed (second
PID1736; first matching lock validated by cleanup). Revised report reload helper
retains explicit completion checks. Full225 subsequently completed0. No assertion
failures or app fix. Timeout chronology reported to parent before commit.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved,
NOT uninterrupted. No app/test changes after native; final browser225 rerun afterward inner/outer0. Dockerstaticonly. Bundlewarning
564.11kB vs500(previous563.94).
