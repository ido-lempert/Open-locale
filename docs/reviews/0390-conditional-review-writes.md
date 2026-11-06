# 0390 - Conditional review writes

## Developer review
Status DTO/controller/client optional version/rowId. Service verifies project/key,
then task lock, translation row FOR UPDATE, checks supplied tokens and updates
status/version/history/activity in same transaction. History now uses locked value
rather than pretransaction read. Optional rowId alone enforced too. Legacy clients
without tokens remain unconditional. Editor sends both loaded tokens, blocks absent/
dirty/pending/needsReload cells, suppresses duplicate review and content save while
review pending. Removed automatic post-content review resend, obsolete mid-save
review unit updated to expect blocked/no call. No schema or bulk-review CAS change.

## Product review
Stale loaded wording cannot be marked reviewed after unseen content changes through
this editor. Fresh explicit reload then review works. Failed/unknown review retains
values and requires copy/reload, no blind replay. Text typed during pending review
is kept; save waits for another blur after review settles. No automatic resubmit,
definitive failure or idempotent outcome recovery guarantee. Legacy unconditional
callers explicitly not covered by editor concurrency promise.

## Designer review
Existing select styling retained; disabled while dirty/pending/absent. Actual800x600
confirmed fresh review pixels inspected, readable unseen wording/green reviewed
select after explicit reload. Existing copy/error UI retained, no new layout.
Not complete mobile/accessibility audit; disabled reason presently explained here
and README rather than per-control tooltip.

## Security review
Version and immutable identity checked under row lock before status/audit writes.
Conflict aborts with no history/activity changes. Server membership/task/status
validation retained. Fixed editor errors no backend exception. Legacy unconditional
support is explicit compatibility, not claimed protected. No external/provider/
worker/spend/license/credential change. Original named-repo authority recovered.

## QA/integration review
API265/31 web382/24 uncached/builds0, initial416.39kB below500budget. Unit4: tokens/
confirmed baseline; unsaved plain/plural/absent block; duplicate pending review and
content guard; failed review no replay/raw error. Browser13 final0 proves two-editor
stale content/review rejection, fresh explicit review, same-version recreated-row
identity409/no history/activity, invalid tokens400, legacy status compatibility and
actual locked wording in history. First two browser runs externally cut120s after
6PASS: reviewer tab background after first-tab edit, owned Nx groups1245/1800 killed,
dead PG sockets55591/55592 left untouched. Final test foreground reviewer, timeout10s,
port55593 yields13PASS inner/outer0. No app fix for fixture. Savebrowser10PASS1FAIL
fresh-reload render race, wait exact Replacement textarea then final11PASS0. Other
suites no failures. All59 bounded integration/config legs final0 (58prior+review13),
config16/docs4-138routes/reaper4. Each browser/native stage isolated. SyncSTAGED
95+144239unique/nativeSTAGED116+128244total242unique inner/outer0, not canonical
uninterrupted. Checkpoints removed/no app-test edits after final native. Docker
static-only/coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
