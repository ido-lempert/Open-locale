# 0394 - Retained-grid content-write boundary

## Developer review
Content save returns before obtaining/creating a cell whenever destroyed or the
key read is pending/failed. Both ordinary and force paths use it. No state update
or request on rejection; ready conditional-write behavior unchanged. This guard
is not request cancellation or saved-draft/list reconciliation. Existing pending
requests remain independently outcome-unconfirmed on failure.

## Product review
A retained grid labeled read-only must not write from a stale blur event. Inert
alone is not the runtime contract. Local values stay available for copy, with
explicit retry still replacing from server. This does not promise automatic draft
restoration or preserve drafts across successful list replacement. Scope content
save only, not a claim about all editor mutation actions.

## Designer review
Actual final retained-grid/copy and retry pixels inspected. Failed retained draft
visible, disabled Save draft and outside-grid copy text readable; current retry
shows feature key Beta. Existing guidance/control layout unchanged. No new UI
surface; screenshots document behavior, not a full mobile/accessibility audit.

## Security review
Reject before cell access, including forced save; no unconditional write fallback
or API/authorization change. Discriminating browser negative control removes only
the new guard and both boundary checks fail via observed PUT/database change,
not because inert prevented event delivery. No new credentials/provider/worker,
spend, license or scope changes.

## QA/integration review
API265/31 web404/27 (+6) uncached/builds0 initial420.47kB below500budget.
Keys browser11 (+2) held GET/failed read with deliberate retained input/blur events,
zero PUT and DB unchanged, local draft retained. Temporary guard removal9PASS2FAIL
exactly new pending/failed checks; restored before final unit/build/sweep, final
11PASS0. Save-version browser10PASS1FAIL explicit reload asserted textarea before
render; exact current First editor value wait added, final11PASS0. No other328
failure/timeout. All62 bounded legs final0, config16/docs4-138routes/reaper4.
SyncSTAGED95+144239unique/nativeSTAGED116+128244total242unique inner/outer0,
checkpoints removed, no app/test edits after native. Not canonical uninterrupted.
Docker static-only/coverage22FULL7PARTIAL1MISSING/defaultOFF and external acceptance
limits unchanged.
