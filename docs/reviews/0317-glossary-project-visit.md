# 0317 - Glossary reused-project visits

## Developer review
Subscribe to route paramMap, reset rows/locales/draft/errors and invalidate previous
read on every project visit. Metadata uses visit generation, not project id alone;
destroy invalidates and unsubscribes. Existing create/save/delete callbacks now
capture original project/visit so introducing route reuse cannot let old completion
clear draft, refetch or publish errors on new visit. Seven units cover old list,
repeated metadata success/failure, destroy and each mutation's late failure.

## Product review
Switching projects now changes glossary, translation columns and editor backlink
instead of retaining previous project. Return to same id is a fresh visit. Draft
reset on navigation is explicit existing task-page behavior, not draft preservation
across projects. Mutation pending guards/retry and raw current mutation errors are
separate work. Old in-flight write may finish at original destination; not cancelled.

## Designer review
Inspected actual480x900 final pixels: New visit draft, current project term/fresh
notes, fr/de columns, no previous Hebrew column. Controls fit. Route-start browser
assertion also proves old terms/locales/draft clear before held response finishes.
No redesign or wide-locale layout claim.

## Security review
Cross-visit metadata/list/mutation callbacks fenced by generation and destroy.
Original write destination captured before await. Actual A->B->A browser compares
real old API bytes with changed current notes/new locale, making stale-response
checks discriminating. Isolated local fixtures; no external provider/account/scope/
spend/license change. Owner upload original recovered before publishing.

## QA/integration review
API265/31/web226->233/13 uncached0/builds0. Glossarybrowser5->8 actual held first-visit
list/project bytes released after second visit settled with changed server state.
47unique integration/config legs including docs inner/outer0; Tasks80/Tasksbrowser23/
Activity22/QA14/reports118/sync644/syncbrowser239 unchanged; reaper4/0/docs4/138routes0.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not
uninterrupted. No app/test edits after native. No suite failures/timeouts/interruption.
Initial browser shell command exit1 was trailing grep's no-match status after suite
and reaper0, not failed verification; final browser rerun command0. Bundle578.18->
578.90kB vs500warning. Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no remote sync/baselineadvance/accepted sync/worker
enablement. Existing report snapshot/window caveats unchanged.
