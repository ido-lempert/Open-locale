# 0332 - Guard QA explicit refresh entry point

## Developer review
Route refresh button through method guard rather than direct fetch. Loading suppresses
repeat explicit refresh; existing fetch destroy/latest-generation fences remain.
Locale-change reads deliberately still call fetch and can replace pending selection.
Two units prove selected locale/project/no metadata, pending repeat and destroy safety.
No API/schema change. No app/test edits after native.

## Product review
Existing disabled button already blocked ordinary repeat clicks. This adds method-level
protection and actual pointer-repeat single-request proof, not a new QA capability.
Not all read deduplication/cancellation/automatic refresh or cross-client concurrency.

## Designer review
Inspected fresh actual480x900 held-refresh pixels: selected he filter retained, disabled
Run checks again, loading text, no stale table/count or empty-success. Narrow layout
fits. No redesign or broad responsive claim.

## Security review
No new data/disclosure/source/account/provider/scope/spend/license or registration.
Local fixtures only. Existing fetch scope/destroy/latest-generation guards preserved.
Owner upload original recovered/live repository/push/main validated before publication.

## QA/integration review
API265/31/web270->272/13 uncached0/builds0. QAbrowser14->15: actual held GET followed
by pointer repeat remains one request/no metadata read during150ms observation; prior
selected-locale result/change/recovery proof retained. Final47unique integration/config
legs inner/outer0 including docs4/138routes. Tasks80/Tasksbrowser29/Glossarybrowser36/
Activity22/reports118/sync644/syncbrowser239/reaper4 unchanged. Native STAGED116+128=
244total/242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted. Slow
suites isolated; no failures/timeouts/interruption266. Docker static-only/no daemon
claim; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted sync/baseline
advance/worker enablement; existing report snapshot/window caveats unchanged.

Bundle583.22->583.26kBvs500warning.
