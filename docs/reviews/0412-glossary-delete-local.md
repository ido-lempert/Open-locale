# 0412 - Targeted glossary deletion

## Developer review
Confirmed delete removes only captured row ID and baseline in original list generation.
Unrelated immutable row identity/local values/pending saves/form draft remain. No
completion/failure GET. Pending deletion blocks reads; unavailable/missing row cannot
submit. Unknown IDs block row save/delete until successful current list read, which
clears only matching global recovery copy. Project/destroy fences remain.

## Product review
Deleting one term must not discard unrelated translation drafts. Unknown result is
not success/failure certainty: fixed copy-first explicit-refresh guidance, no blind
replay or automatic replacement. Failed read retains unknown state. Explicit Refresh
still replaces local fields; no durable uncertainty/idempotency/exactly-once guarantee.

## Designer review
Inspected desktop confirmed delete with Alpha local save and newer form draft. Long
unknown-row warning squeezed unrelated input; shortened to row status while full
copy-first guidance stays above form. Recaptured and inspected: full input readable,
row status/disabled controls clear. Existing glossary narrow assertions pass; no new
responsive audit.

## Security review
No raw server errors or external requests added. No API/schema/worker/account/scope/
license/spend changes. Native split keeps all assertions and private source-bound
checkpoint checks; wrong progression rejected, final output counts actual startup
repeats. Owner upload authority/live target verified before push.

## QA/integration review
Unit9 covers targeted row identity, duplicate/save/read blocking, unknown replay/read
failure/recovery, unavailable row and project/destroy. Initial old bootstrap fixture
caused unhandled rejection because delete now guards loading; corrected readiness.
Next630PASS1FAIL exposed overbroad read guard affecting create generation test; narrowed
to pending deletion. Final web631/44 API265/31 uncached builds0 initial441.27kB. First
batch inner0/outer1 detached-child notice; fresh reaped batch inner/outer0 accepted.
New browser6/0 then6/0 after visual copy fix. Existing glossary38/0 fixture explicitly
refreshes unknown delete before further edit. Broad API/browser final0 isolated.
SyncSTAGED95+144239unique0. Native second twice host120s cut at123PASS/no failed
assertions/completion absent. Retry stale socket zero checks/exit1. New optional
middle/tail split preserves all assertions; final source first116/middle111/tail19,
246total242unique/four repeated startup checks, every inner/outer0. Earlier split
aggregate output corrected then rerun all three. Not canonical uninterrupted pass.
Final sync-config16/native-config14/docs4-138routes/reaper4 all0.22FULL7PARTIAL1MISSING/
defaultOFF/external acceptance unchanged.
