# 0385 - Safe screenshot context reads

## Developer review
Each read owns a generation and private temporary URL map. Selected key/generation
and destruction checked after metadata and each image await. Publish list and URLs
together only after all succeed. Unpublished URLs revoked in finally, published
URLs revoked by clear/read replacement. Stale metadata starts no blob reads;
stale blob returns after revoking what it created and starts no next blob. Reload
closes pane; destroy clears. Upload/delete confirmed success updates matching count
and refreshes only unchanged selected pane. Removed full reload to preserve other
editor drafts; it no longer silently reopens a pane closed during upload. Existing
concurrent mutation outcome/error recovery and editor-wide list races out of scope.

## Product review
Translators should not see another key's visual context or a false empty success.
Fixed inline error/retry, hidden metadata until image bytes ready. Read retry does
not upload/delete. No automatic retry/cancellation/external provider connection.
Confirmed upload/delete still work in native browser suite, no API change.

## Designer review
Existing table/thumbnail style preserved, status/alert roles and explicit button.
Desktop error/retry pixels inspected, text and controls readable/no pane clipping.
Stored test image is existing1px green fixture enlarged at160px, not real product
photography. Existing wide grid/mobile layout and complete accessibility not audited.

## Security review
No raw list/blob error in pane. Literal filename/actor interpolation unchanged,
server image validation/auth unchanged. Owned blob URLs revoked on all specified
paths; not a claim of secure memory erasure or aborting network. Unit partial-failure
and stale-blob cleanup verified; browser instruments actual create/revoke calls.
Test isolated disposable DB/API/browser only, no spend/license/credential change,
external registration or worker enablement. Original repository upload permission
recovered before commit; live target and previous remote match checked.

## QA/integration review
API265/31 web352/19 uncached/builds0, initial409.50kB below unchanged500budget.
Six new unit cases: old list success/error; stale blob close stops further images;
partial blob failure cleanup/retry; replacement/reload/destroy cleanup; pending
upload cannot reopen changed pane and count updates from confirmed success.
Browser10 final PASS inner/outer0: held list A->B, authenticated B atomic display,
close revocation, held blob hidden/late closed cleanup, fixed failure and stored
image retry, destination destruction/revocation, read-only/no runtime error.
Initial9PASS1FAIL: test waited generic form already in editor instead of actual
settings navigation. Fixture now waits destination path and grid absence; no app
fix for test issue. Final rerun after confirmed-mutation count fix10PASS0.
All54 bounded integration/config legs final0 (53 prior+shots browser), docs4/138routes,
sync stage config16/reaper4. Each browser/native stage isolated. Sync STAGED95+144
239unique/native STAGED116+128244total242unique all inner/outer0; not canonical
uninterrupted. Checkpoints removed; no app/test edits after final native stages.
Docker static-only, external sync/IdP/MT/CDN acceptance and22FULL7PARTIAL1MISSING/
defaultOFF unchanged. No timeout/interruption in319.
