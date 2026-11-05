# 0348 - Snapshot project visit scope

## Developer review
Subscribe paramMap and unsubscribe on destroy. New visit resets list/draft/errors/
notices/pending flags and increments project/read generations. Capture/restore use
captured project ID and visit fence on success/catch/finally. Five units list and
create/restore success/failure A B A. No API/schema or app/test edits after native.

## Product review
Reused project route must not display previous project's snapshots or let its late
mutation change current draft/notices/pending. Server work not canceled, returned
same project is a new visit. Route resets draft intentionally; not persistent drafts.

## Designer review
Inspected actual480x900 repeated-project pixels: current list/retained new draft,
restore controls enabled, no old error/notice. Browser also verifies next-project
list/back link/reset draft. No layout change or broad responsive claim.

## Security review
Old private503 marker not rendered after repeated visit. Scope captures explicit
project ID and visit generation, not only ID equality. Local fixtures only; no new
source/disclosure/account/provider/scope/spend/license/registration. Original authenticated
owner upload recovered; live repository/push/admin/main validated.

## QA/integration review
API265/31/web291->296/14 uncached0/builds0. Snapshotbrowser17->19 actual heldfirstA
restore503 across A B A: B current list/link/reset, repeatedA list/new draft/controls
unchanged after old failure/no raw detail/runtime. Create success/failure and restore
success fences unit-covered; no matching browser claim. No failures/timeouts/
interruption282.49unique bounded integration/config legs inner/outer0 including
docs4/138routes/config16/reaper4. Snapshot19/QA21/Activity28/Tasks31/Glossary38;
sync644/automation132/2FA37/reports118 all0. Syncbrowser STAGED95+144=239unique both0/
checkpointremoved, not canonical uninterrupted. Native STAGED116+128=244total/242unique
PG55534 both0/checkpointremoved, not uninterrupted. Each browser/native stage isolated.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
sync/baselineadvance/worker enablement; report snapshot/window caveats remain.
Bundle584.91->585.40kBvs500warning.
