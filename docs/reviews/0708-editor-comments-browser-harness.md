# Fail-closed editor comment browser verification

## Developer
Four older comments/read-recovery/refresh/toggle scripts track completed state
separately from assertion failures, increment caught aborts and retain nonzero
exit through cleanup. Child Nx daemon disabled. Timestamp script unchanged.

## Product
Verification reliability only. No application comments API, posting, reply,
deletion, translation autosave, refresh or draft behavior changes.

## Designer
No application visual change. Harness output distinguishes startup abort,
nonzero exit and no application PASS assertions. Existing browser checks exercise
actual desktop/mobile flows; no new UI screenshot acceptance claim.

## Security
Isolated ephemeral local databases and harness-owned temporary listener. No
external provider, new credential, permission, worker, spend or license change.
Existing child process-group cleanup retained.

## QA and integration
- Actual occupied-PostgreSQL-port harness: five scripts x three checks =15/0.
- Negative probe temporarily removed comment guards: exactly one failure,
  detecting actual zero-exit startup abort; restored then harness15/0 again.
- Unmatched selection rejects instead of reporting empty success.
- Actual local comments13/read-recovery8/refresh11/toggle7/time8 browser47/0.
- Syntax/diff and docs4/138routes pass. Application code unchanged; builds/units
  not rerun. No whole-product/native/sync/external acceptance claim.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged.
