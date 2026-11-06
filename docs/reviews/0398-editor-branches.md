# 0398 - Empty-branch create continuation

## Developer review
Pending create guard, captured submitted/trimmed name, preserves newer name draft.
Confirmed create then independent list-only refresh. Latest-list generation and
destroy fences prevent stale list/error publication. No grid reload/branch switch.
No cancellation or exactly-once semantics. Project-id route reuse remains outside
this change, consistent with existing bootstrap limitation.

## Product review
Success followed by failed list must remain success, with explicit missing-list
feedback/manual retry. Unknown create keeps name/check-list guidance, no automatic
replay. Existing current translations remain usable; no general mutation recovery.

## Designer review
Pending/error/recovered desktop pixels inspected. Parent caught ambiguous initial
"Empty branch created created" for branch named created. Changed to quoted name
and "was created", asserted exact full notice in unit/browser, recaptured both
success/list-error states. Final text wraps cleanly; not a responsive audit.

## Security review
Fixed scoped messages suppress backend details. No credentials/provider/API/schema
or worker changes, no new external audience/spend/license choice. List response
published only while current, destroyed create cannot continue. Original upload
scope/live target to recheck before push.

## QA/integration review
API265/31 web438/30 (+6) uncached builds0, initial425.97kB. Browser4 real held POST
and newer draft, duplicate guard, confirmed create with failed list, list-only retry
finds persisted branch/no second POST or key GET, no runtime errors. Initial browser4
preceded copy correction; repeated final4 with exact notice, final pixels inspected.
Broad API/browser legs completed across bounded calls, never one sweep claim.
SyncSTAGED95+144239unique inner/outer0/checkpoint removed. Native first116/0 and
second127PASS1FAIL/1: obsolete old notice string after copy correction. Replaced
with exact final notice, fresh first116/0 second128/0,244total242unique, checkpoint
removed. This is staged, not canonical uninterrupted success. Final config16/docs4-138routes/reaper4 all0. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged; no
external acceptance promotion. No worker enablement, spend or credential changes.
