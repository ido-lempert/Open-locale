# 0404 - Single-file import local-work boundary

## Developer review
Real import reuses current grid/cell readiness, preview stays read-only. Pending
real write blocks content/review/bulk handler requests. Confirmed changed-local-work
completion preserves cells/copy-first explicit reload. Unknown submitted result
invalidates grid to stop blind replay. Review distinguishes local JSON parse error
(no request/no grid freeze) from unknown submitted outcome. Other mutations/bundle
import remain independent; no cancellation or general reconciliation.

## Product review
Do not replace a draft typed while import is sent. Confirmation still reports import
committed but local text was kept and must be copied before reading server values.
Unknown submitted import requires explicit current read before another real import,
even a known validation response conservatively. Preview allowed with dirty draft.
Not an exactly-once or rollback guarantee, and unrelated mutations can still reload.

## Designer review
Actual existing-draft blocked and confirmed-import/newer-draft retained screens
inspected. Fixed copy guidance, retained-grid copy control/read-only grid visible,
no overlap. No responsive audit. Generic keys-unavailable wording inherited.

## Security review
Runtime content/review/bulk guards, not just controls. Fixed parse/unknown messages
hide backend details. No API/schema/worker/provider/credential-scope/spend/license
changes. Original owner upload/live target recheck before push. Coverage unchanged.

## QA/integration review
API265/31 web515/36 (+14), uncached builds0. Browser5 dirty zero import, pending typing
zero blur PUT, persisted Imported/local newer draft/no key GET/copy control, unknown
replay blocked. First4PASS1FAIL wrong retained-copy selector; existing name corrected,
final5. Initial web514 then parse boundary review+1 final515. Broad API/browser final0
across bounded calls. SyncSTAGED95+144239unique inner/outer0/checkpoint removed.
Native first111PASS5FAIL: existing runner continued real imports after submitted
invalid-XLIFF outcome now freezes grid. Added explicit Retry keys/current-read wait
at that boundary, no relaxed assertions; fresh first116/0 second128/0,244total242unique,
checkpoint removed. Staged, not canonical uninterrupted success. Each browser/native
stage isolated. Final config16/docs4-138routes/reaper4 all0. No coverage/external acceptance
promotion;22FULL7PARTIAL1MISSING/defaultOFF unchanged.
