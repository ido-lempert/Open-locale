# 0057 - Import bundle (zip of per-locale files)

POST /api/projects/:projectId/import-bundle/:format accepts an
application/zip body (raw parser registered for that content type only, 40
MiB transport cap) and imports one entry per locale, the inverse of
export-bundle. `?branch=` scopes writes exactly like single-file imports.

Two things this endpoint is NOT, stated plainly:
- It is not a general ZIP importer. Only the store-only subset described
  below is accepted: ordinary compressed (deflated) zips from other tools are
  rejected with 400, not decompressed. Archives from this app's export-bundle
  (or byte-compatible writers) are the supported input.
- It is not atomic across locales. Each locale imports (or fails, or is
  skipped) independently and the response reports all three lists; a partial
  multi-locale outcome is the normal failure mode, not an error to retry
  blindly.

## Decisions and boundaries

- Read subset (readZip in translations/zip.ts) is the exact inverse of the
  export writer and deliberately narrow: EOCD at len-22 (no archive comment),
  single disk, no ZIP64, method 0 (store) only, no data descriptors,
  compressed == uncompressed size, CRC32 verified per entry, unsafe names
  (traversal segments, backslashes, empties, duplicates) rejected. Central
  and local headers must agree on flags, method, CRC, sizes and name bytes;
  entry data ranges must be pairwise disjoint and clear of the central
  directory. Any deviation: 400 before a single entry is read, and because
  parsing completes before the first write, a rejected archive writes
  nothing. Shared budgets: 256 entries, 32 MiB including overhead.
- Entry-to-locale mapping: flat namespace (entries in directories are
  skipped), extension must match the declared format, stem matches a locale
  by exact code first, then by the export's zipSafeName form so an exported
  bundle round-trips; an ambiguous sanitized stem is skipped, never guessed.
- Per-locale partial semantics, mirroring the documented per-key partial
  single-file import: each locale imports through the existing per-locale
  path with its grants, task locks, branch scoping and atomicity. A locale
  rejection (403 grant, 400 parse, per-file 2,000,000 character cap) lands in
  failedLocales with its status; unmatched entries land in skipped with a
  reason; neither aborts the other locales. Non-HTTP errors rethrow.
- Response: { format, branch, imported: [{ locale, keysCreated,
  translationsUpserted, unchangedSkipped, failed, ... }], skipped: [{ name,
  reason }], failedLocales: [{ locale, status, error }] }.
- No new permission surface: membership via projects.getFor, per-locale write
  grants via the existing import path. No ImportRun row per locale beyond
  what each single-file import already records (it records them the same
  way). No snapshot semantics change.

## Verification

- zip.spec.ts reader cases: buildZip round-trip byte-exact, truncation, CRC
  tamper, deflate method, data descriptor, traversal name, duplicate names.
- formats-test legs: export-bundle -> import-bundle round-trip across
  projects in JSON (both locales land, values equal - the JSON flat map is
  lossless for the supported subset; a CSV bundle round-trip is NOT
  value-lossless because the default spreadsheet-safe export prefixes
  formula-leading values, exactly like single-file safe CSV re-import),
  unknown format 400, missing application/zip body 400, CRC-tampered archive
  400, unmatched locale skipped with reason, member with he-only grant
  imports he and gets en in failedLocales (403) without abort.
- Hostile archives at the API boundary: central/local disagreement and an
  entry range reaching into the central directory both 400 with the target
  project's keys byte-identical before/after (zero writes).
- Lock boundary: a member's bundle import skips a task-locked key per locale
  (failed count, others land; the write path reports counts, the reason text
  is covered by the preview legs). Branch boundary: ?branch= import lands on
  the branch and leaves main byte-identical.
