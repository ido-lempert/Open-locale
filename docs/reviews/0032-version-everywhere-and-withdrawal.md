# 0032 - Version on every write path + withdrawal behavior

## What shipped
- Every translation-mutating path now advances `Translation.version`:
  interactive upsert, `setStatus`, bulk status (one UPDATE that also bumps),
  JSON/format imports, branch merge (both cutoff and unconditional raw
  INSERT..ON CONFLICT statements), and snapshot restore. Verified
  numerically per path: v3->4 import, 4->5 setStatus, 5->6 bulk, 7->8
  restore, 8->9 merge.
- Status changes are protected: because status writes bump the token, a stale
  in-context value save now 409s instead of silently resetting a newer
  REVIEWED decision; tested that the 409 leaves status and value untouched.
- Delete/recreate ABA, tested: a recreated key has a NEW id, so a frame
  holding the old keyId gets 404. A removed/re-added locale restarts rows at
  version 0/1, so an old expectedVersion 409s. Residual: a recreated locale
  row that climbs back to the exact same version number would pass the check
  - accepted as a known narrow hole, since row identity (keyId) and fresh
  reads on conflict limit its blast radius.
- Trust withdrawal on the open frame (in-context): removing the embed origin
  now (a) silences host-message answers AND (b) visibly pauses editing:
  banner, disabled inputs/buttons. Unsaved drafts are captured and kept.
  A save attempt while withdrawn writes nothing (revalidation runs at save
  time too, using document.referrer as the host origin). Re-allowlisting
  re-enables editing with the draft intact - all without reload.
- Overwrite re-checks: the conflict "Overwrite" path re-runs the full
  save path, which revalidates trust and lets the server re-check
  membership/locale permission before any write.

## Verified
scripts/incontext-edit-test.mjs - 32 checks, real PG + HTTP + Chrome,
including frame-04-withdrawn.png pixels for the disabled state.

## Explicit limits
- Drafts are in-memory: a full frame reload loses them (stated in the frame
  banner only as "kept" for the session; persistence would need localStorage
  and is a deliberate non-goal this slice).
- Withdrawal detection is reactive (on message or save attempt), not a push
  channel; a frame sitting idle shows the paused state on its next
  interaction.
- document.referrer can be suppressed by a hostile referer-policy on the
  host; in that case save-time revalidation skips the origin check and the
  server-side membership/permission checks still gate the write. The
  message-path revalidation (event.origin) is unaffected.
