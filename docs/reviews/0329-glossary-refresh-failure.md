# 0329 - Actual explicit glossary refresh failure/retry

## Developer review
Two actual browser checks exercise newly added explicit refresh failure and retry.
Existing list recovery already clears stale data, preserves new-term draft and uses
fixed guidance. Designer review found orphaned compressed headings under failed-list
alert; hide whole table for listError and tighten browser assertion. No API/schema
change. No app/test edits after native stages.

## Product review
Rejected explicit GET must not look like successful empty list or leave stale terms.
Actual retry restores server rows/refresh control and whole draft remains throughout.
Not unsaved row translation retention, concurrency, automatic retry or cancellation.
Server-value replacement hint remains on successful view.

## Designer review
Inspected actual fresh480x900 failure and recovered pixels after fix. Failure shows
fixed readable alert/retry, no orphan table headings/stale rows/empty-success; term/
notes/checked box remain. Recovery shows actual added term/context, refresh/hint,
whole draft and no pending/error/overflow. No broader responsive claim.

## Security review
Synthetic503 raw marker absent from UI, fixed guidance only. No new retrieval source,
disclosure/account/provider/scope/spend/license or external registration. Existing
read/visit/destroy fences unchanged. Isolated fixtures only. Original owner upload
recovered and live push/main verified before publication.

## QA/integration review
API265/31/web264/13 uncached0/builds0. Glossarybrowser31->33: rejected explicit GET
hides table/refresh without empty-success/raw detail; retry restores actual rows/
context/control without losing whole draft, runtime clean/narrow fit. Review-driven
template fix reran final units/build/browser before all wider regression/native.
Final47unique integration/config legs inner/outer0 including docs4/138routes. Tasks80/
Tasksbrowser26/Activity22/QA14/reports118/sync644/syncbrowser239/reaper4 unchanged.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not
uninterrupted. Known slow suites isolated; no failures/timeouts/interruption263.
Docker static-only/no daemon claim; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
No accepted sync/baselineadvance/worker enablement; existing report snapshot/window
caveats unchanged. Bundle582.83->582.93kBvs500warning.
