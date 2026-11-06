# 0406 - Scoped editor exports

## Developer review
One shared pending guard across file, bundle, TMX and legacy JSON download entry
points. Captures format/locale/branch/slug/bootstrap generation. Branch/locale/format
changes including away-and-back, import auto-detection, bootstrap replacement or
destroy suppress old download/error/notice. Local search/list reads do not invalidate
server export, which deliberately ignores grid filters. URL cleanup is in finally.
No cancellation, automatic retry, file-save confirmation or local-draft export.

## Product review
Saved-server-only guidance prevents confusing exported values with local drafts.
TMX explicitly project-wide memory for selected locale, not branch-filtered. Current
request may finish on server after scope change but no stale download is initiated.
One pending export remains until that response settles; user can retry explicitly.
Export feedback separate from import/copy-first notices. Existing filenames preserved,
including no branch in filename; current confirmation names branch for file/zip.

## Designer review
Inspected actual desktop pending/confirmed export screenshots: disabled controls,
pending explanation, saved-server/TMX guidance, confirmed EN export with local draft
still visible. No overlap. Existing compact inline toolbar retained; no responsive audit.

## Security review
Handlers enforce pending/scope at actual post-response download boundary. Fixed export
failure avoids exposing backend details. No provider/API/schema/worker/spend/license
or credential-scope change. URL revoked after click/failure; authorization unchanged.
Original owner upload authority/live target rechecked before push. Coverage unchanged.

## QA/integration review
API265/31 web557/38 (+21), uncached builds0 initial437.22kB. Browser6/0 real held
GET verifies all export controls disabled, EN->HE response discarded, current EN
filename/blob saved-server contents while local draft remains, fixed failure and
old-format response discarded. Initial5PASS1FAIL render-readiness for cleared feedback;
explicit DOM wait corrected, final6 and post-review6. Unit matrix file/csv/text/zip/TMX/
legacy names, six scope-change paths success/error, URL cleanup, fixed failure/retry.
Broad API/browser final0 across bounded isolated calls. Mistyped journal npm script
first exit1/zero checks, correct webhook-deliveries-browser16/0. OIDC55 on optional
fixture port55625, no bind conflict this slice. SyncSTAGED95+144239unique0, native
STAGED116+128244total242unique0, inner/outer0/checkpoints removed. Not canonical
uninterrupted claims. Every browser suite/native stage isolated. Final sync-config16/native-config10/docs4-138routes/reaper4 all0.
22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
