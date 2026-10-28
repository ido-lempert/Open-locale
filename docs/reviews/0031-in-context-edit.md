# 0031 - In-context edit writes (server-authoritative, optimistic concurrency)

## What shipped
- `Translation.version` (int, default 0): optimistic-concurrency token.
  `PUT /projects/:id/keys/:keyId/translations` accepts optional
  `expectedVersion` (0 = "no row yet"). When present:
  - Existing row: SELECT ... FOR UPDATE locks the row, then the LOCKED version
    is compared - the value checked is exactly the value overwritten. Mismatch
    is 409 with {currentValue, currentVersion}; nothing is written.
  - Missing row: conditional INSERT ... ON CONFLICT DO NOTHING; a concurrent
    create becomes a 409, never a silent overwrite.
  - Committed writes increment the version. Omitting expectedVersion keeps the
    previous last-writer-wins behavior (the SPA editor uses that path).
- Every write still goes through assertLocaleWrite (membership + per-locale
  permission, server-side, per request); keys are branch-scoped rows, so a
  write lands on the branch the key belongs to. History rows carry the actor.
- Frame edit UI: per-row input + Save button for the edit locale
  (?locale=, default the project's base locale). Saves are click-initiated
  inside the frame only; the host-message protocol has NO write type (tested:
  ol:save/ol:write attempts change nothing and get no reply).
- Conflict UX: on 409 the frame re-reads the key list and shows the true
  current server value with "Use latest" / "Overwrite with my text" (overwrite
  re-sends with the fresh version - an explicit user decision).
- Live revalidation: the frame re-reads the project allowlist from the server
  on EVERY inbound host message before answering, so removing an origin
  silences an already-open frame (and lost membership wipes the frame back to
  the sign-in state). Re-allowlisting restores answers without reload.

## Verified (scripts/incontext-edit-test.mjs, 20 checks, real PG+HTTP+Chrome)
- Version math: create@0 -> v1, matching -> v2, stale -> 409 + untouched row,
  compat write -> v3, expectedVersion 0 on existing row -> 409.
- Locale-restricted member: en 403, he 200; 3 history rows, all attributed.
- Browser: editable rows render; frame save lands via API (v4) with "Saved"
  indicator; injected server write then frame save -> conflict UI showing the
  real current value; conflicted save does NOT overwrite; explicit overwrite
  resolves; host-message write attempts move nothing; live origin removal
  silences the open frame; re-allowlisting restores it.
- Pixels: frame-01-editor.png, frame-02-saved.png, frame-03-conflict.png.

## Explicit limits
- expectedVersion is optional: clients that omit it keep last-writer-wins.
  Only the embed frame (and future clients that send it) get conflict safety.
- Status-only writes (setStatus/bulk) do not bump the value version; they do
  not conflict with value edits by design.
- Merge/restore/import replace rows through their own serialized paths; a
  frame holding a stale version across those gets a 409 on next save (safe
  direction).
- Live revalidation adds one project read per inbound host message - fine at
  ping/highlight rates; a busier protocol would need caching with a short TTL.
