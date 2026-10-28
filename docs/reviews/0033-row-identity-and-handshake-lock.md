# 0033 - Immutable row identity + fail-closed handshake

Closes the two residuals called out after 0032: (1) a recreated locale row
could climb back to the exact same version number and pass a version-only
check (ABA collision); (2) the frame used document.referrer as the host
origin, which a host page can suppress (Referrer-Policy), so embedding trust
was not positively established.

## What shipped
- `Translation.rowId UUID NOT NULL DEFAULT gen_random_uuid()` (migration
  20261029013000_translation_rowid): an immutable row identity assigned at
  row creation, never reused on recreate.
- Write boundary: `PUT .../translations` accepts optional `expectedRowId`.
  The FOR UPDATE locked read now also selects rowId; when expectedRowId is
  provided and mismatches, the write 409s with
  `{currentValue, currentVersion, currentRowId}` - even when the version
  matches. Callers that omit expectedRowId still pass on version alone
  (documented compat path).
- The embed frame tracks `{version, rowId}` per key, sends both on save and
  on conflict "Overwrite", and adopts the fresh identity on "Use latest".
- Fail-closed handshake: the frame no longer consults document.referrer at
  all. When embedded, editing stays visibly locked (banner + disabled
  inputs/buttons; saves refused) until a verified handshake: a protocol
  message whose source is window.parent AND whose origin is on the fresh
  server-fetched allowlist AND whose schema is strict. Only that message
  establishes state.parentOrigin and unlocks editing. Revalidation at every
  message and every save checks state.parentOrigin against the live
  allowlist; removal withdraws editing (banner, disabled controls, drafts
  kept, nothing sent to the host).

## Verified
scripts/incontext-edit-test.mjs - 51 checks, real PG + HTTP + Chrome
(local fixture hosts, not a real host integration):
- API ABA: recreated he row climbed back to the SAME version with a NEW
  rowId; a stale save carrying the old rowId with the matching version 409s
  with the new currentRowId; the recreated row is untouched; version-only
  save (no rowId) still commits (compat); save with matching rowId commits.
- Frame ABA: frame saved v1/rowId R1; the de row was removed/re-added and
  recreated at v1 with rowId R2; the frame's stale save surfaced the
  conflict UI showing the true current value ("recreated draft"), wrote
  nothing; "Use latest" adopted {v1, R2} and the next save landed at v2.
- Fail closed: on an allowlisted host with Referrer-Policy: no-referrer
  (referrer suppressed), the frame renders locked - inputs and Save
  disabled, lock banner visible; a save attempt while locked writes nothing.
  After the host's verified ol:ping handshake, editing unlocks and saves
  land.
- Origin removal between handshake and save: the save-time revalidation
  stops the write, the withdrawal banner appears, inputs disable, the
  unsaved draft stays in the input, and the server value is unchanged.
- Denied host (origin never allowlisted): CSP frame-ancestors on the served
  shell blocks the frame from loading at all; a ping from that origin gets
  no pong and causes no writes.
- Withdrawal/re-allowlisting from 0032 reruns green.

## Scope limits
- Tested interleavings, not a race-proof guarantee: the FOR UPDATE lock
  covers concurrent writers at the database; we tested sequential stale
  holders, not a timing race harness.
- The handshake proves the top host origin at message time and revalidates
  it at save time; it does not attest anything about the host page's own
  content or about ancestors above the top frame (nested-ancestry blocking
  remains CSP frame-ancestors' job, covered in 0030).
- Frame pixel evidence: frame-00-locked.png, frame-05-aba.png,
  frame-06-withdrawn-save.png.
