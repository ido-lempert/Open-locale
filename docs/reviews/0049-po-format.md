# 0049 — PO (gettext) import/export

The plan's format list (PO/POT, XLIFF, ARB, RESX) had no gettext
support; the IO toolbar offered JSON, CSV, Android XML and iOS strings
only. PO is the most common open-source interchange format, so it goes
first.

## What changed

- `po.ts`: dependency-free emitter and parser. Keys map to msgids 1:1.
  Subset, stated in the module header: plain msgid/msgstr entries with
  C-style escapes and multiline adjacent strings. The metadata header
  (empty msgid) and obsolete entries (#~) skip silently; plurals
  (msgid_plural, msgstr[n]) and contexts (msgctxt) cannot roundtrip
  into flat keys and are rejected with a count; malformed lines
  (unterminated strings, unknown directives) reject the entry without
  dropping the rest of the file. Unknown escapes keep both characters
  (never drop data); duplicate msgids collapse to the last occurrence.
  Fuzzy flags are comments and import like any entry.
- API: `GET /projects/:id/export/:locale/po` (text/plain) and a `po`
  field on the import endpoint; import follows the established pattern
  (any rejected entry fails the whole request with 400 before a single
  key is touched - the mixed-import test proves keys, and by the
  android-section precedent, activity/history stay untouched).
- Web: the IO toolbar format picker gains "PO (gettext)"; export
  downloads `<slug>.<locale>.po`; import accepts .po files.

## Verification

- Unit (po.spec.ts, +7): escape emission, lossless roundtrip (quotes,
  newlines, tabs, backslashes, unicode, empty value), multiline
  adjacent strings with comments, header + obsolete skip, plural/
  indexed/context rejection, malformed-line rejection with file
  salvage, unknown-escape preservation.
- API (formats-test, +6): import with fixture comment and obsolete
  entry (2 upserted), export content-type, escaped export content,
  export-import roundtrip (unchangedSkipped >= 2), plural 400, mixed
  valid+context import 400 with keys byte-identical before/after.
- Boundary (formats-test, +8): branch scoping (PO import with
  ?branch= is invisible on main JSON export, present on the branch
  export; PO export reads the named branch), locale grants (he-only
  member: PO import to en 403, to he 201; PO export en 200 - writes
  constrained, reads not), task key lock (locked po.title skipped with
  failed=1 in the import summary for a non-admin non-assignee while an
  unlocked key lands; locked value verified unchanged after import).
- UI (e2e-visual, +3): select PO, import a .po fixture through the
  file input, summary notice names the format, the key appears in the
  grid; export captured via the generated blob contains the msgid and
  escaped msgstr. editor-35-po.png (top of grid) and
  editor-35b-po-row.png (po.demo row framed fully; the last grid row
  cannot center without temporary body padding, so the shot pads,
  centers, restores) pixel-inspected.

## Review pass notes

- Developer: line-based state machine mirrors android-xml.ts style;
  msgid_prefix ordering (msgid_plural/msgctxt before msgid) is
  load-bearing and covered by the plural/context unit cases.
- PM: gettext users get the exact headers their tools expect; rejected
  constructs are named in the 400 message, not silently dropped.
- Designer: the format picker label matches the other formats
  ("PO (gettext)"); no layout change.
- Security: import is fail-closed (any rejected entry 400s the whole
  request before mutation, same as Android XML); the parser is
  linear-scan, no regex backtracking surface; 2MB DTO cap matches the
  other formats.
- QA/integration: unit-api 50 tests (+7), formats-test PO section,
  e2e-visual PO block; full sweep settles green at the final tree.
