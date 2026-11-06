# 0414 - Snapshot restore current-list boundary

## Developer review
Shared readiness predicate drives disabled control and handler. Restore requires
exact selected row from usable current list, no loading/error/capture/restore or
destruction. Capture project/read generation before confirmation and recheck after
it; stale row or scope cannot send. Existing restore result/read/error behavior and
confirmation wording unchanged.

## Product review
Destructive restore must be chosen from the currently available snapshot list.
Old handlers cannot restore during failed/loading reads or after replacement, even
when IDs match. Fresh explicit selection and full destructive confirmation remain.
This does not validate remote snapshot existence at click time, add cancellation,
or resolve unknown submitted restore outcomes.

## Designer review
Inspected actual failed-list desktop: clear read error/Retry snapshots, no stale
restore rows, label form remains. Shared readiness keeps current buttons consistent
with handlers. Existing snapshot narrow/layout suite passes; no visual redesign.

## Security review
Readiness before confirmation/write; captured project/read generation prevents
retargeting across confirmation. Browser negative legs invoke captured old handler
against real pending/failed/replaced reads and prove zero dialogs/POSTs. No added
API/schema/worker/provider/account/credential-scope/license/spend changes. Owner
upload evidence/live target verified before push.

## QA/integration review
Unit13 loading/error/missing/replaced row/capture/restore/destroy guards; read/project/
row/destroy/capture changes during confirmation; fresh exact row normal result/full
warning. Existing restore fixtures now establish usable selected row. API265/31
web653/46 uncached builds0 initial442.18kB. New actual browser5/0 twice: old handler
pending GET/failure/replaced exact-ID row sends nothing; fresh restore confirms once
and removes discriminating post-snapshot key (DB exists before/absent after). First
run strengthened DB assertion, not a failure. Pixels inspected. Existing snapshot44
and broad API/browser all0 in isolated calls. SyncSTAGED95+144239unique/nativeSTAGED
116+111+19246total242unique/four repeated startup checks, every inner/outer0/checkpoints
removed. No failed assertions, aborted/interrupted verification, or canonical
uninterrupted claim. Final sync-config16/native-config14/docs4-138routes/reaper4 all0.
22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
