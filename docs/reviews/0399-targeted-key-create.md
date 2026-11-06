# 0399 - Targeted key creation

## Developer review
Captured name and branch, pending duplicate guard, newer input retention. Returned
key inserted only in same list generation/branch, usable unfiltered grid. Existing
cells unchanged, duplicate returned identity not inserted twice. Destroy suppresses
success/failure continuation. No exactly-once/cancellation/general mutation claim.

## Product review
Creating a key must not wipe unrelated translation drafts. Confirmed filtered or
changed-grid creation tells original branch, no mismatching row. Copy-first guidance
before clear filters/reload; unknown result is not safe automatic replay.

## Designer review
Held create/translation, confirmed retained grid, fixed failure and filtered notice
pixels inspected. Review cleared prior success notice on new attempt and captured
branch in fixed failure rather than referring misleadingly to current branch.
Final error/filtered screenshots recaptured/readable no overlap, not responsive audit.

## Security review
No API/schema/provider/worker/credential scope/spend/license changes. Raw failure
hidden, branch-specific fixed message, no old-grid insertion. Existing owner upload
evidence/live target must be checked before push. Coverage/defaultOFF unchanged.

## QA/integration review
API265/31 web450/31 (+12) uncached builds0. Browser5 real held PUT/POST proves DB
Original/new key persisted/no list GET/draft retention; duplicate guard/fixed failure/
filtered no-injection. Initial3PASS then abort wrong search selector, corrected to
accessible label/final5. Broad API/browser checks all final0 across bounded calls.
Sync-preview default55482 bind conflict twice,0checks inner0 but harness correctly
fails1, no success credited. TCP refused but bind unavailable; no unknown PID killed.
Added optional SYNC_PREVIEW_TEST_PG_PORT (default unchanged), final644/0 port55608.
SyncSTAGED95+144239unique and nativeSTAGED116+128244total242unique inner/outer0,
checkpoints removed. Not canonical uninterrupted success. Final config16/docs4-138routes/reaper4 all0. No external acceptance or coverage promotion.
