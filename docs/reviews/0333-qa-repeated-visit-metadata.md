# 0333 - Actual repeated-visit QA metadata failure fence

## Developer review
Test-only actual held first-visit metadata503 after A->B->A proves project-generation
fence, not just project-ID comparison. Successful second-A metadata/selected he and
findings/count remain unchanged after first-A rejection. Existing application passes
without edits. No API/schema change; no app/test edits after native stages.

## Product review
Old metadata failure must not remove current options or imply current findings failed.
Actual route reuse preserves current state. Not request cancellation/automatic retry,
all-read deduplication or cross-client concurrency.

## Designer review
Inspected actual480x900 final pixels after release: selected he, three current findings,
count/refresh remain; no old error/retry/loading. Existing horizontally scrollable
QA table keeps document narrow; visible detail is clipped to scroll area, not a claim
that all columns fit simultaneously. No design change.

## Security review
Synthetic old503 marker is observed in response but absent from UI. No new retrieval
source/disclosure/account/provider/scope/spend/license or registration. Isolated local
fixtures only; existing scope fences unchanged. Owner upload original recovered/live
repository/push/main validated before publication.

## QA/integration review
API265/31/web272/13 uncached0/builds0. QAbrowser15->17: actual held first-A metadata
failure after A->B->A cannot remove current locale options/selection/findings/count or
publish old error/retry/loading/raw detail. Runtime clean/narrow document fit. Final47
unique integration/config legs inner/outer0 including docs4/138routes; Tasks80/
Tasksbrowser29/Glossarybrowser36/Activity22/reports118/sync644/syncbrowser239/reaper4.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not
uninterrupted. Slow suites isolated; no suite failures/timeouts/interruption267.
Progress-message transport returned daemon timeout; later status reported without
blind resending. Docker static-only/no daemon claim; coverage22FULL/7PARTIAL/1MISSING/
defaultOFF unchanged; no accepted sync/baselineadvance/worker enablement. Report
snapshot/window caveats unchanged; bundle583.26kBvs500warning unchanged.
