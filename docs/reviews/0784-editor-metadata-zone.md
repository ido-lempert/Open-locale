# Editor metadata clock timezone

## Developer
Comment/reply/history labels use medium seconds+displayed zone instead of short.
All three use semantic time with exact valid source datetime; invalid omitted.
No stored text/time, sorting, request, download or mutation handler changed.

## Product
Nearby recorded edits and discussion times become distinguishable by seconds
and zone. History remains loaded saved changes, not a complete snapshot or
current editor values. Refresh is still read-only and preserves unsent text.

## Designer
Inspected actual comments/history desktop and390px mobile pixels. Root/reply
and history zone labels readable; long reply label wraps, bodies, draft field
and controls stay intact. Invalid fallback shown beside preserved comments in
history capture. No document overflow or unrelated grid-layout edit claimed.

## Security
Invalid source never placed into time datetime or displayed as raw label.
Private discussion/history content stays existing local UI. No provider,
registration, credential scope, spend, worker, sharing or license changes.

## QA and integration
- New equivalent-instant/seconds/zone unit; old short label negative1 fail/0 pass.
 Fixed restored. Existing short-format expectation updated intentionally.
- Affected time/comments/history12 suites118 tests pass, no full-web rerun claim.
- Actual browser9/0: equivalent root/reply zone labels, exact raw time metadata,
 comment+history390px fit, invalid reread fallback/attribute omission, unsent
 comment draft retained, history saved text retained, six reads/no writes,
 no runtime errors. Real disposable API/PostgreSQL root/reply fixture with
 intercepted comment/history GETs. No comment posted during verification.
- Production web/API builds, docs4/138routes, syntax/diff pass.
- No whole-product/native/sync/provider rerun claim. Coverage22 FULL/7 PARTIAL/
 1 MISSING and external acceptance gaps unchanged.

Five review passes complete; old formatting regression expectation updated.
