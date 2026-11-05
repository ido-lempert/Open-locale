# 0361 - Discriminating snapshot mutation precondition

## Developer review
Removed always-true mutation precondition. Correct current translation DTO, record
HTTP write statuses and changed value before delete, explicitly create blank new-key
translation so flat export includes it. Exact final pre-restore shape checked.
Negative unchanged-state fixture proves predicate rejects no-op setup. Test-only;
no app/API/schema changes or app/test edits after native stages.

## Product review
Restore proof now starts from observed distinct changed/deleted/added state, rather
than assuming mutations happened. No claim this fixes application transactions or
concurrency. Manual capture root-Prisma use inside activity transaction noticed for
separate atomicity investigation; this slice does not resolve it.

## Designer review
No UI/layout change. Integration evidence is HTTP statuses and exact before/after
state, not a screenshot claim. Existing browser44 remains verified.

## Security review
Local fixture only, no new account/provider/scope/disclosure/spend/license or
registration. Stronger precondition prevents false confidence in recovery checks.
Original owner upload recovered and live repository/push/main checked before publish.

## QA/integration review
First discriminating run28PASS1FAIL inner/outer1 exposed obsolete {translations}
request body400 and new key omitted from flat export without translation. Fixed to
{locale,value}, explicitly persisted blank translation, exactHTTPstatus/value/keyshape
precondition and negative unchanged-state check. Final snapshots28->30 inner/outer0.
API265/31/web304/14 uncached0/builds0;49unique bounded integration/config final legs
inner/outer0 incl snapshotbrowser44/docs4/138routes/config16/reaper4. No timeout295.
Each browser/native stage isolated. Syncbrowser STAGED95+144=239unique both0/checkpoint
removed, not canonical uninterrupted. Native STAGED116+128=244total/242unique both0/
checkpointremoved, not uninterrupted. No app/test edits after verification.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kBvs500warning unchanged.
