# 0336 - Consume Activity key debounce on immediate read

## Developer review
Any accepted fetch cancels/clears pending key timer before issuing request. Immediate
action/actor change therefore consumes pending combined key query without a later
duplicate read/reset. Existing pending-page guard runs first. Two fake-timer units
cover action/actor paths; latest-generation/project/destroy fences preserved.
No API/schema change; no app/test edits after native stages.

## Product review
Typing key then changing action/actor immediately previously triggered an immediate
read and a delayed duplicate. Keep combined filters, one read during this sequence.
Not all request deduplication/cancellation/concurrency. Key filter searches keyName,
not task title. Empty result is correct for the actual fixture.

## Designer review
Inspected actual480x900 final pixels after400ms window: created-task/Owner/Fresh filters
retained, refresh enabled, empty result, no error/loading. Narrow layout fits. No design
change or broader responsive claim.

## Security review
No new source/disclosure/account/provider/scope/spend/license/registration. Isolated
fixtures only; existing scope/destroy checks preserved. Owner upload original recovered/
live repository/push/main verified before publication.

## QA/integration review
API265/31/web272->274/13 uncached0/builds0. Activitybrowser24->26 actual key input then
immediate action selection: exactly one GET with key/action/actor, no delayed duplicate
during400ms observation, selected filters/runtime clean. First browser25pass/1fail
fixture expected task-title match, but key filter searches keyName. Corrected expected
empty result, kept single-request/exact-query assertions; final26/inner0/outer0.
Final47unique integration/config legs verified, with SAMLbrowser61 on temporary PG55542
fixture copy only; all completed legs inner/outer0. Standard SAMLbrowser PG55478 failed
bind0checks three attempts (third unsupported env override still standard port). No
assertion failure; copied script changed only PG constant and removed afterward.
Other legs Tasks80/Tasksbrowser29/Glossarybrowser36/QA19/reports118/sync644/syncbrowser239/
reaper4/docs4/138routes. Native STAGED116+128=244total/242unique PG55534 inner/outer0/
checkpointremoved, not uninterrupted. Slow suites isolated; no outer120s interruption.
Docker static-only/no daemon claim; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged;
no accepted sync/baselineadvance/worker enablement. Report snapshot/window caveats remain.

Bundle583.26->583.32kBvs500warning.
