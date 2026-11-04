# 0321 - Actual glossary save project fence

## Developer review
Test-only extension holds actual successful PATCH across reused project navigation,
then verifies original persisted translation and no current-project list read/draft/
error/pending change. Separate held503 proves late failure/raw detail stays out of
current visit. Existing implementation unchanged. No API/schema.

## Product review
A request started before navigation may finish at original destination. New project
must stay independent. This proof is bounded to actual fixture outcome/observation,
not cancellation, idempotency, unbounded no-retry or cross-client concurrency. Prior
unsaved-edit replacement by other mutation refetch remains separate work.

## Designer review
Inspected actual480x900 final screenshot: current draft retained, current fr/de rows
and enabled controls, no old error or pending. Normal narrow input text scrolling;
exact translation values verified in browser/API. No layout change.

## Security review
Injected private-old-save response bytes observed by test, absent from rendered page.
Interception confined to isolated local fixture PATCH and original project. No
provider/account/scope/spend/license/audience change. Owner upload original recovered;
live remote main and push access verified before publication.

## QA/integration review
API265/31/web245/13 unchanged uncached0/builds0. Glossarybrowser17->19 final0.47unique
integration/config legs including docs inner/outer0; Tasks80/Tasksbrowser23/Activity22/
QA14/reports118/sync644/syncbrowser239 unchanged. Reaper4/0/docs4/138routes0. Native
STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted.
No app/test edits after native; no failures/timeouts/interruption255. Bundle580.38kB
vs500warning unchanged. Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no remote sync/baselineadvance/accepted sync/worker
enablement. Existing report snapshot/window caveats unchanged.
