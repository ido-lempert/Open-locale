# 0335 - Actual repeated-visit Activity actors failure fence

## Developer review
Test-only held first-A members503 after A->B->A proves project-generation fence,
not just project-ID comparison. Existing app passes unchanged: second-A options/
selected actor/feed survive first-A rejection. No API/schema change; no app/test
edits after native stages.

## Product review
Old actor discovery failure must not make current successful feed/options look
unavailable. Actual reused route preserves current state. Not cancellation/automatic
retry/all-read deduplication or cross-client concurrency.

## Designer review
Inspected actual480x4099 full-page pixels and480x900 top crop after release: Owner
selection, current feed/refresh remain, no old error/retry/loading. Narrow content
wraps normally; top crop is only first viewport, full evidence includes feed/load-more.
No design change or broader responsive claim.

## Security review
Synthetic old503 marker observed in response and absent from UI. No new retrieval
source/disclosure/account/provider/scope/spend/license or registration. Isolated local
fixtures only; existing scope fence unchanged. Owner upload original recovered/live
repository/push/main validated before publication.

## QA/integration review
API265/31/web272/13 uncached0/builds0. Activitybrowser22->24: first-A503 after A->B->A
cannot remove successful current options/actor selection/feed or publish old error/
retry/loading/raw marker; runtime clean/narrow fit. Final47unique integration/config
legs inner/outer0 including docs4/138routes; Tasks80/Tasksbrowser29/Glossarybrowser36/
QA19/reports118/sync644/syncbrowser239/reaper4. Native STAGED116+128=244total/242unique
PG55534 inner/outer0/checkpointremoved, not uninterrupted. Slow suites isolated.
Chronology: isolated syncbrowser120s interrupted225checks, deadPG7467/noTCP verified,
stale55479 socket removed/leftover suite Nx/Chrome stopped. Clean isolated retry239/
inner0/outer0. Incomplete attempt not a pass; no failed assertions or test weakening.
Docker static-only/no daemon claim; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged;
no accepted sync/baselineadvance/worker enablement. Existing report snapshot/window
caveats and bundle583.26kBvs500warning unchanged.
