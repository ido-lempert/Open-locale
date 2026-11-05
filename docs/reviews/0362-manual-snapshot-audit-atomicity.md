# 0362 - Manual snapshot/audit rollback boundary

## Developer review
Capture helper accepts Prisma transaction client, default root client retained for
automatic paths. Manual create explicitly passes its audit transaction client for
key read and snapshot write. Real audit-write failure rolls back manual snapshot.
No schema/API/UI change. No app/test edits after native stages.

## Product review
Failed manual audit must not leave unaudited snapshot behind. Scope is manual capture
and its audit write only, not repeatable-read/serializable snapshot consistency,
automatic capture/pruning atomicity or full restore transaction semantics. Uncertain
network-response behavior still applies after successful commit.

## Designer review
No UI/layout change. Verification is real HTTP500 and database row counts, not a new
screenshot claim. Existing snapshotbrowser44 verified against rebuilt API.

## Security review
Failure injected with local PostgreSQL trigger rejecting snapshot.created activity.
Trigger/function dropped in finally. No production test hook or external source,
account/provider/scope/disclosure/spend/license/registration. Original owner upload
recovered and live repository/push/main checked before publication.

## QA/integration review
Discriminating pre-fix31PASS1FAIL inner/outer1: audit trigger rejected insert500 but
manual snapshot persisted through root Prisma. Fixed helper transaction client; final
snapshots30->32 inner/outer0: failed audit500, both row counts unchanged/no failed-label
snapshot. Trigger removed before remaining success/recovery/retention tests.
API265/31/web304/14 uncached0/builds0;49unique bounded integration/config final legs
inner/outer0 incl snapshotbrowser44/docs4/138routes/config16/reaper4.
Native first initialPG55534 startup0checks/outer1, address in use/no owned visible
postgres process/no checkpoint. Failed data dir cleaned. Alternate55554 bind checked,
then final isolated116+128 both0/checkpointremoved,244total242unique STAGED, not
uninterrupted. Unknown listener not killed. Syncbrowser STAGED95+144=239unique both0/
checkpointremoved, not canonical uninterrupted. No timeout296. Each browser/native
stage isolated; no app/test changes after verification.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kBvs500warning unchanged.
