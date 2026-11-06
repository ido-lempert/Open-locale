# 0409 - Translation-memory apply readiness

## Developer review
Before local target mutation, reuse readiness semantics for pending import/bulk/grid/
key deletion and dirty/saving/review/unknown/row identity target. Keep offered option
and local value untouched if blocked. Explicit current offered option still saves
through existing conditional content path. No asynchronous gap between guard/edit/save.

## Product review
Blocked memory click no longer inserts a local value that save immediately rejects.
Unavailable options remain visible/disabled with save/wait/copy-reload guidance. An
explicit click is required after readiness returns, no queued/automatic application.
Empty target means no local plain/plural difference from confirmed state; whitespace
or local deletion is still a draft. Source-match behavior and read requests unchanged.

## Designer review
Actual held-import/disabled-memory and ready-keyboard-apply/saved desktop screenshots
inspected. Guidance wraps inside cell, no overlap, disabled option distinct. Existing
memory percentage is match score, not translation quality. No responsive audit.

## Security review
Runtime guard precedes local mutation, disabled controls alone not trusted. Conditional
save retains row identity/version checks. Synthetic disabled-button click sends no PUT
and leaves target untouched in real browser. No API/schema/worker/provider/credential-
scope/spend/license changes. Original upload evidence/live target checked before push.

## QA/integration review
Unit16 covers14 unavailable states plus ready new/existing row explicit apply. API265/31
web607/41, uncached builds0 initial441.27kB. Browser3/0 first run: real held import, synthetic memory
click target stays empty/DB absent/zero PUT; after import completion explicit keyboard
pick writes once as unverified. Pixels inspected. Broad API/browser final0 across
isolated calls. SyncSTAGED95+144239unique/nativeSTAGED116+128244total242unique inner/
outer0/checkpoints removed. OIDC55 on55637. No test failures or interruptions this slice;
not canonical uninterrupted claims. Final sync-config16/native-config10/docs4-138routes/reaper4 all0.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
