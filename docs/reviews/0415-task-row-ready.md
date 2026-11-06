# 0415 - Task row current-list boundary

## Developer review
Shared readiness drives row controls/update/delete handlers. Exact selected row
must belong to usable current list, with no row mutation pending or destruction.
Blocked update restores provided select value unless destroyed. Independent current
rows can still mutate concurrently. Existing completion refresh, filters, project
fences and reviewed domain errors remain unchanged.

## Product review
A row from an older filter/read cannot update/delete a task no longer shown. Fresh
current selection remains actionable. This guards local row provenance, not remote
version concurrency or unknown-outcome replay. Existing server domain/permission
checks remain authoritative. No general mutation reconciliation claim.

## Designer review
Inspected actual failed-list desktop: clear retry guidance, no stale row actions,
new-task form intact and readable without overlap. Existing task31/native layout
checks pass. Disabled controls share exact handler readiness; no visual redesign.

## Security review
No request before exact current-row/usable-read checks. Captured old browser handlers
exercise real pending/failed/replaced lists; both update/delete send zero writes.
No API/schema/worker/provider/account/credential-scope/license/spend changes. Original
owner upload evidence/live target verified before push.

## QA/integration review
Unit16 covers update/delete loading/failure/missing/replaced/update/delete/destroy,
control revert and fresh exact row. Existing mutation fixtures establish usable rows;
independent-row tests remain. API265/31 web669/47 uncached builds0 initial442.18kB.
New actual browser6/0 first run: held/failing/replaced list plus captured old handlers,
zero PATCH/DELETE/control revert, persisted OPEN unchanged, fresh explicit status
persists DONE once then current read. Pixels inspected. Existing tasks31 and broad
API/browser all0 isolated calls. SyncSTAGED95+144239unique/nativeSTAGED116+111+19246total
242unique/four repeated startup checks, every inner/outer0/checkpoints removed.
Duration pause preserves completed checks; no failed assertions, aborted/interrupted
verification or canonical uninterrupted claim. Final sync-config16/native-config14/
docs4-138routes/reaper4 all0.22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
