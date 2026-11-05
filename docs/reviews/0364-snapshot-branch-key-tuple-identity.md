# 0364 - Snapshot restore branch/key tuple identity

## Developer review
Six branch+key concatenations in restore silently aliased valid tuples (a,bc) and
(ab,c). Encode every keep-set/byName/idByName identity with JSON.stringify of the
string tuple. Both components remain distinct even with boundary-like characters.
Branch fallback for pre-branch snapshots remains main. No persisted format/schema
change. Real fixture covers post-snapshot key deletion and paired-value restoration.

## Product review
Restoring one branch's key must not retain another branch's colliding key, nor write
its value into the other branch. This is within-project data correctness, not a
cross-project authorization change. Existing snapshot metadata/UI/API stay unchanged.
No blanket snapshot consistency, exactly-once, serializable capture, automatic
pruning or full restore atomicity claim.

## Designer review
Backend-only correction; no visual change or new screenshot claim. Existing
snapshot browser44 passed against rebuilt API. Evidence for this fix is actual
HTTP responses, deletion count and per-branch exports after real database restores.

## Security review
Ambiguous identity could mix data across branches within one project. Unambiguous
tuple encoding fixes the six related restore lookups without new input restrictions.
Existing project/admin/task-lock gates remain. Local disposable database tests only;
no account/registration/token-scope/spend/license/new audience. Owner upload request
recovered directly; repository/push/main verified at publication.

## QA/integration review
Initial old API fixture35PASS3FAIL: deletion defect prevented recreation of the
second key, causing a downstream fixture precondition failure as well as both real
defects. Isolated paired case by deleting leftovers, then asserted successful
writes and both changed export values before restore. Rebuilt original API with
final fixture:36PASS2FAIL, exactly deletion and separate-value restoration. Fixed
final snapshots38/inner0/outer0, prior34 assertions retained. Initial shell command
accidentally added nonexistent npm fix.log label0checks/RC1; no application effect.

Final API265/31, web304/14 uncached and both builds0;49unique bounded integration/
config legs final inner/outer0, snapshotbrowser44/docs4/138routes/config16/reaper4.
Syncbrowser95+144=239unique STAGED, both0/checkpointremoved, not canonical
uninterrupted. Native116+128=244total/242unique STAGED, both0/checkpointremoved,
not uninterrupted. Port55554 bind checked first. Each browser/native stage isolated.
No app/test changes after stages. No timeout298. Only docs added afterward.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement. Report snapshot/window caveats remain.
Bundle586.40kB vs500kB warning unchanged.
