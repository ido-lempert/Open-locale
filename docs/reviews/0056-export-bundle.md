# 0056 - Export bundle (all locales, one zip)

GET /api/projects/:projectId/export-bundle/:format returns one store-only zip
with one entry per project locale (base included, sorted by code) in the
requested format: json, csv, android, ios, po, xliff, properties, arb, yaml.
Unknown format: 400. `?branch=` scopes entries exactly like the single-locale
exports.

## Decisions and boundaries

- Store-only (no compression) writer in translations/zip.ts, no dependency:
  local headers, central directory, EOCD, CRC32, UTF-8 name flag, fixed DOS
  date (deterministic output). Validated against Python's zipfile and a
  structural parser in zip.spec.ts.
- Entry bytes come from the existing per-locale exporters. csv/android/ios/
  po/xliff/properties/arb/yaml entries are byte-equal to their single-locale
  endpoints (csv compared with mode=raw; the bundle uses raw because the
  spreadsheet-safe prefix is a per-file spreadsheet concern, and a bundle is
  not opened as one sheet). The json entry is the flat map pretty-printed
  with a trailing newline; it is content-equal, not byte-equal, to the
  ?flat=true endpoint body. No other formats are implied.
- Read boundary unchanged: team membership via projects.getFor, same as the
  single-locale exports. Locale write grants do not narrow reads (member 200
  covered in formats-test). No new permission surface.
- Entry names: zipSafeName(locale) + extension - unsafe characters collapse
  to '-', leading dots/dashes stripped, traversal impossible, empty collapses
  to 'file'. A sanitization collision between two locales fails closed (400)
  instead of silently dropping one. Download filename: <safe-slug>-<format>.zip.
- Limits: 256 entries and 32 MiB total (store-only, so compressed ==
  uncompressed). Over the size limit: 413; over the entry limit or a name
  collision: 400. ZIP64 is not emitted; the cap keeps every offset 32-bit.
- No locking, no snapshot, no import run: export is read-only.

## Verification

- zip.spec.ts: CRC32 vector, byte-exact round-trip, determinism, UTF-8 names,
  duplicate/limit rejections, zipSafeName cases (unit-api).
- Python zipfile parse: testzip clean, entries byte-exact, UTF-8 name intact.
- formats-test legs: disposition + one entry per locale, json flat-map
  equality, byte-equality for the eight text formats, unknown format 400,
  member read 200, branch scoping.
