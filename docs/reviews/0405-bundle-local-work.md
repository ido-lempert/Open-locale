# 0405 - Bundle import local-work continuation

## Developer review
Bundle write shares single-file pending state, captures branch/format/locale/list
generation and suppresses late changed-scope success/error/reload. Dirty, pending,
unconfirmed or unavailable grid blocks a write. Confirmed completion with newly
edited cells preserves local values and requires copy/current read. Scope changes
do not cancel the submitted request. No general concurrent-mutation reconciliation.

## Product review
One pending import across bundle/single-file inputs. No automatic replay after an
unknown submitted result; fixed copy warns some locales may have changed. Preserve
per-locale skipped/failed/no-rollback semantics. Even a known validation error is
conservatively unconfirmed in the UI until explicit current read. Not atomic or
exactly-once; successful clean same-scope import still refreshes current keys.

## Designer review
Inspected actual desktop blocked-existing-draft and retained-newer-draft screenshots.
Fixed guidance and retained copy/retry controls visible, no overlap. Existing generic
keys-unavailable wording remains. No responsive audit or unrelated UI changes.

## Security review
Runtime local-work guard and shared write guard, not only disabled inputs. Fixed
unknown feedback hides backend error details. Native fixture independently asserts
real CRC-tampered POST HTTP400 and CRC mismatch body; fixed UI copy does not weaken
server validation. No API/schema/worker/provider/credential-scope/spend/license changes.
Original owner upload authority and live target checked before push. Coverage unchanged.

## QA/integration review
API265/31 web536/37 (+21), uncached API/web builds0, initial435.80kB. Browser5/0
real exported zip, dirty zero request, pending controls, newer draft retained/no
GET/blur PUT while DB receives Bundle source, unknown replay blocked. Pixels inspected.
Broad API/browser final0 across isolated calls; syncSTAGED95+144239unique inner/outer0.
OIDC default55472 bound twice (zero checks/exit1); optional test PG port preserves
default, final55/0 on55621. No unknown process killed.
Initial native run hit host120 limit after obsolete CRC-copy assertion and downstream
unknown-grid import failures; own runner PID16318/group stopped, checkpoint removed.
Updated fixture verifies fixed UI plus separate real400/CRC rejection, then explicitly
retries current keys before more imports. Fresh native first116/0 second128/0,
244total242unique, inner/outer0, checkpoint removed. Staged, not canonical uninterrupted
success. Every browser suite/native stage isolated. Final sync-config16/native-config10/docs4-138routes/reaper4 all0.
22FULL7PARTIAL1MISSING/defaultOFF and external acceptance unchanged.
