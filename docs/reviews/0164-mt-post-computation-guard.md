# 0164 - MT guard after provider computation

## Developer pass
MT accepts optional internal beforeWrite callback and awaits it after driver output/
scoring, before opening write transaction. Automation supplies shared repository
current-intent/captured-rule guard. Ordinary HTTP callers omit options. Guard
rejection throws before translation/history/MT activity; automation records failed
rule through existing error handling. No provider interface/registry change.

## Product pass
Computed stale output is discarded rather than written after scope changes during
provider work. Not whole-rule rollback, per-rule retry deduplication or overall
sync completion. Earlier locale fills remain. No enabled worker/public apply/
baseline advance/remote write/external acceptance;22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI changes. Current native1280x800 editor screenshot inspected for readable
locale columns/saved state/memory suggestion without overlap. Existing UI evidence,
not a new visual feature. README/plan describe pretransaction boundary literally.

## Security pass
Provider computation holds no eligibility locks. Current repository lease/admin/
target/key/value and rule revision checked afterward before transaction. Guard
still point-in-time: not transactional scope locking, no post-check race claim.
No external registration/token scope/spend/license/audience changes.

## QA/integration pass
Automation68->74: actual MT service/offline pseudo driver computes; explicit
beforeWrite fixture seam changes actual target revision, DB-clock lease expiry or
authenticated rule disable/restore, then delegates production-supplied guard.
Each asserts guard supplied+failure and zero target translation/history/MT activity.
Not external provider acceptance or a mocked MT result. Existing explicit summary
failure doubles retained. Existing locale/task/real-socket cases remain passing.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs14 clean
fail-closed batches,all individual/outerRC0;48 inventory. Webhook45,migration10,
sync268/browser98. Native116+128=244 total/242 unique,all242 literal source labels
covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted. No failing test
or host interruption98. No active fixture services/temp bundles on completion.
