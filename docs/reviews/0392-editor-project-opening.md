# 0392 - Recoverable editor project opening

## Developer review
Required project and branches read concurrently and publish together only for the
current bootstrap generation. Destroy invalidates it; optional glossary also
checks current generation on success/failure. Keys retain their own read fences
and error/retry. No request cancellation or project-id route reuse handling.
No changes to API, storage, write baselines or workers. Retry is exposed only on
failed bootstrap, not as an editor refresh/draft replacement control.

## Product review
Initial failure previously left a Loading heading and raw service error, without
an actionable retry. Fixed access/connection guidance and Retry project recover
without a full reload. Failed branch load must not show half-ready toolbar/grid.
Optional glossary unavailable does not block basic translation work. No automatic
retry, draft restore or definitive distinction between connection/access failures.

## Designer review
Actual desktop error/loading/ready pixels inspected. Fixed heading now says
Project unavailable after failure, rather than misleading Loading. Inline alert
and retry are legible near top with no clipping; status explains loading required
metadata. Existing secondary navigation stays available. Not a full responsive or
accessibility audit. Final error screenshot inspected after heading correction.

## Security review
Bootstrap never renders raw provider error. Late metadata/optional glossary cannot
mutate destroyed/superseded bootstrap. Existing server access enforcement unchanged.
No credential scope, registration, spend, license or worker enablement change.
Named-repository upload scope recovered from owner's original authenticated messages.

## QA/integration review
API265/31 web391/26 (+7)/uncached builds0, initial418.51kB below500budget.
Browser7: fixed project failure/no raw error/no partial editor, held manual retry
feedback, real project+branch+keys recovery, branch failure/no partial editor,
branch retry, held bootstrap route-away, no runtime errors. Initial5PASS1abort
was fixture clicking project-list link before rendering; exact selector wait
fixed it, final7PASS0. Sweep typo snapshots-browser returnedRC1/0checks (nonexistent
script), corrected snapshot-browser44RC0. All61 bounded integration/config legs
final0; config16/docs4-138routes/reaper4. SyncSTAGED95+144239unique/nativeSTAGED
116+128244total242unique all inner/outer0, checkpoints removed, not canonical
uninterrupted success. No app/test edits after native. Docker static-only;
coverage22FULL7PARTIAL1MISSING/defaultOFF and external acceptance limits unchanged.
