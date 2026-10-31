# 0126 - Repository read and explicit draft resolution composition

## Developer pass
RepositoryPreview.resolve freshly re-reads remote through the bounded contents
adapter and checks the existing repository-scoped fingerprint before resolving.
Snapshots selections before first await, alongside existing target/baseline
snapshots. Same resolver bounds, explicit selection/absence semantics and digest.
No reuse of caller remote JSON or mutable old plan. No writes/retries.

## Product pass
Internal composition only, not an endpoint or connected integration. Returns
repository-preview-resolution source and contents-adapter-read remote source;
canApply=false, baselineProvenanceVerified=false. Baseline exact-byte SHA is
consistency, not accepted provenance. No repo enrollment, stored credential,
accepted baseline, sync worker, push/import or external acceptance. Coverage
unchanged. Existing local file UI remains separate, not silently promoted.

## Designer pass
No UI changes. Existing local preview/resolution UI regression42 checks and
native visual stages retained. No screenshot claims about a new repository UI.
Errors distinguish changed preview, invalid choices/fingerprint and read failure.

## Security pass
Production origin remains fixed and pinned; no HTTP token endpoint or development
publishing credential used by product. Malformed fingerprint/choice map shape
rejected before I/O. Fresh fingerprint binds owner/repo/path/branch/local bytes/
exact baseline bytes and current remote SHA/content. Caller mutations during
remote fetch cannot change selected values or returned scope. Existing symlink,
submodule, redirect, SHA/size/UTF8 guards retained. Failures produce no draft or
partial success, no remote PUT. No apply token or authority created.

## QA/integration pass
API227->235 tests/27 suites. Eight new tests run real local HTTP fixture: fresh
GET resolution, changed remote stale rejection, owner/repo/branch mismatch and
path metadata mismatch, local/baseline-byte stale rejection, choice/scope/baseline
mutation snapshot, provider403 no retry/partial result, malformed fingerprint/
choice shapes before network, exact choices and explicit omission. Recorded
methods prove GET-only. Existing transport tests unchanged. Fixture tokens only,
not provider acceptance or live GitHub credentials.

43 unique integration/config legs in nine completed fail-closed batches, all
individual/outer RC0; plus API/web units, both builds and reaper =48 sweep legs.
Web29/6 suites; reaper4. Native visual first116 +second128=244 total with two
repeated startups=242 unique, every source assertion label covered. Both stage
inner/outer RC0, checkpoint removed. Staged, not uninterrupted. No failures or
interrupted verification this slice. Working services cleaned up.
