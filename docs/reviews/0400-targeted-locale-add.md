# 0400 - Targeted locale addition

## Developer review
Returned locale appends only to same bootstrap generation and usable project.
Existing locale not duplicated; translation cell signals untouched. Raw submitted
input comparison preserves a newer code even with equal trimmed text. Pending
handler/button guard, destroy fence. No refetch/reload or request cancellation.

## Product review
Confirmed locale addition no longer fails because of an independent read and does
not erase local translations. Existing locale response says available, not newly
created. Unknown addition retains code and check-settings guidance/no auto replay.
A new empty local cell is not proof server content is absent: current conditional
content-save baseline prevents blind overwrite; fresh reads remain explicit.

## Designer review
Real retained-draft/new fr column, newer de input, pending and fixed failure states
captured. Success/failure desktop pixels inspected, readable/no overlap, existing
local value remains visible. No responsive audit claim. Prior notice cleared on a
new attempt so stale success is not confused with the pending/unknown attempt.

## Security review
No API/schema/provider/worker/credential scope/spend/license changes. Fixed error
hides private service details, late bootstrap/destroy completion suppressed. No
exactly-once or general editor mutation recovery claim. Original owner upload
scope and live target must be rechecked before push.

## QA/integration review
API265/31 web459/32 (+9), uncached builds0 initial428.13kB. Browser5 real held PUT
and POST checks persisted fr/DB Original/local draft/newer de/no project or key GET,
pending duplicate guard, repeated existing-fr response only one column, fixed unknown
failure/no automatic replay/no runtime errors. All broad API/browser legs final0
across bounded calls; each browser/native stage isolated. SyncSTAGED95+144239unique
inner/outer0/checkpoint removed; nativeSTAGED116+128244total242unique inner/outer0,
checkpoint removed. Not canonical uninterrupted claims. Final config16/docs4-138routes/reaper4 all0. Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
