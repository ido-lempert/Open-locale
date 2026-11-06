# 0403 - Captured single-file import scope

## Developer review
Pick scope includes branch/locale/format/list generation before byte read. New pick
invalidates earlier bytes, scope/list changes invalidate conflict/results, destroy
suppresses all. Conflict choice uses same captured scope, no delayed retargeting.
Pending guard spans request and successful reload, cleared in finally. Read failure
caught and input reset immediately. No request cancellation or generic import ledger.

## Product review
Delayed local bytes must never import into a newly selected locale/branch. Pending
copy explains changing scope does not cancel sent request. Late changed-scope result
suppressed, original request may still commit. Single-file only: bundle import and
general draft reconciliation untouched; same-scope successful import still reloads.
Unknown result check-server guidance is not safe-replay/exactly-once guarantee.

## Designer review
Actual pending status/disabled single-file inputs and changed-HE scope after EN
commit inspected. Readable/wrapped/no overlap. Conflict retains explicit format
choice; scope change clears stale banner. No responsive/accessibility audit claim.

## Security review
Captured parameters plus generation boundary prevent confused-deputy locale/branch
retargeting through delayed file bytes. Fixed errors hide service details. No API/
schema/worker/provider/credential-scope/spend/license changes. Original owner upload
evidence/live target to recheck before push. No external acceptance promotion.

## QA/integration review
API265/31 web501/35 (+12), uncached builds0. Browser5 real deferred File.text change
to HE sends no request, conflict removed on locale change, held EN POST then HE
selection persists EN only/no late key GET/notice; disabled pending inputs/runtime
clean. No interim failing test337. All broad API/browser legs final0 across bounded
calls, browser suites/native stages isolated. SyncSTAGED95+144239unique inner/outer0
checkpoint removed; nativeSTAGED116+128244total242unique inner/outer0/checkpoint
removed, not canonical uninterrupted claims. Final config16/docs4-138routes/reaper4 all0.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
