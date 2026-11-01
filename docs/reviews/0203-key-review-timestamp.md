# 0203 - Bind internal recovery to reviewed key timestamp

## Developer pass
Internal diagnostic selects key updatedAt; lock/writer require expectedKeyUpdatedAt
alongside reviewed branch/value digest. Locked recheck rejects mismatches. Existing
writer and two-connection race fixtures bind their own key timestamp. No schema change.

## Product pass
A reviewed key with a changed stored timestamp is rejected even if visible fields
return to prior values. This is not a monotonic generation and cannot distinguish
edits sharing the same stored timestamp. No complete ABA prevention claim. Internal
only,no public restore/token,repository effect composition or remote writes.
22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
No UI change. Current actual480x900pixel eligibility screenshot inspected: dated UTC
snapshot/not-live/refresh/no-reservation/no-restore notice,metadata/button readable
and inside card. Upper summary partly behind sticky header;card/notice fully visible.
Local fixtures,not production/user data.

## Security pass
Comparison occurs after current admin/project/audit/key/branch/locale/generation locks
within Serializable transaction. Public response whitelist still excludes internal
key timestamp/value digest/scope. No external registration,token scope expansion,
spend,license/audience or production data/settings changes. Timestamp precision
limitation is explicit in README/plan and this review.

## QA/integration pass
Actual PostgreSQL metadata change+restore denies old reviewed timestamp;explicit stale
2020 timestamp denied. Sync427->429 initial and finalRC0. Existing writer rollback,
create/recovery races and public whitelist checks still pass. Browser138RC0.
No failures,startup issues,timeouts or interrupted calls137.

Final43integration/config legs in14completed failclosed batches,all individual and
outerRC0. API248/30,web65/7,both builds,reaper4RC0(48nonvisual inventory). Migration17,
sync429,browser138,automation132,webhook45,135routes. Native staged116+128=244total,
242unique labels,all242literal labels covered,inner+outerRC0,checkpoint removed.
Staged,not uninterrupted. No app edits after builds/broad verification;documentation
caveat and this review only afterward.
