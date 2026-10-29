# 0051 - Java .properties import/export

## What landed

Java .properties joins JSON, CSV, Android XML, iOS strings, PO and XLIFF in
the import/export format picker, the API (`GET /export/:locale/properties`,
`POST /import/:locale` with `properties`), and OpenAPI docs.

Subset, stated plainly: `key=value` (or `:` or whitespace) lines, `#`/`!`
comments, backslash continuation lines, standard escapes
(`\t \n \r \f \\` `\= \: \space` and `\uXXXX`). Keys escape separators and
spaces on export; values escape control characters. Non-ASCII is written as
UTF-8 (Java 9+ default) rather than native2ascii `\uXXXX`. Rejected,
never silently skipped: separator-less lines, duplicate keys, malformed
escapes (lone trailing backslash, bad `\uXXXX`).

Duplicate semantics, two levels: the parser keeps the first occurrence and
counts later ones as rejected (salvage semantics, unit-tested), but the
endpoint is fail-closed - any rejected line 400s the whole request before
anything mutates, so the salvage path is unreachable through the API.
Verified: a mixed file (duplicate pair + another valid key) leaves every
stored key byte-identical. Same structure on the XLIFF path (duplicate
ids), also verified byte-identical.

## Verification

- Unit (properties.spec.ts, +7): escaped export, separator/space key
  escaping, lossless roundtrip (newlines, tabs, backslashes, unicode, empty,
  separator-containing keys), colon/whitespace separators with comments,
  `\uXXXX` decode and escaped-backslash-then-n preservation, continuation
  join, rejection of separator-less/duplicate/bad-escape lines.
- API (formats-test, +15): import with comment, continuation and `\uXXXX`
  (4 upserted; decoded values verified), content-type, export escaping
  (literal UTF-8, two-char `\n`), export-import roundtrip stable,
  separator-less 400 with keys byte-identical before/after, duplicate 400 with keys byte-identical (including the other valid line in the same file); XLIFF duplicate-id 400 verified byte-identical the same way;
  boundaries through the .properties path: branch scoping (invisible on
  main, present on branch, export reads the branch), locale grants
  (he-only member 403 on en, 201 on he, export en 200), task key lock
  (non-admin non-assignee import skips the locked key with failed=1 while
  an unlocked key lands; locked value unchanged).
- UI (e2e-visual, +3): select Java properties, import a .properties fixture
  with a `\u2713` escape, summary notice names the format, key appears in
  the grid; export captured via the generated blob contains the decoded
  value. editor-37-properties.png pixel-inspected (row fully framed).

## Review pass notes

- Developer: sequential unescape (replace-chains would corrupt escaped
  backslash + n); continuation join counts odd trailing backslashes; the
  whitespace-separator rule means a bare token line is the only
  separator-less case.
- PM: the picker says "Java properties"; UTF-8 emission documented in the
  export header comment.
- Designer: one new option row; no layout change.
- Security: fail-closed import; linear-scan parser, no regex backtracking
  surface; 2MB DTO cap matches the other formats.
- QA/integration: unit-api 64, formats-test 67, e2e-visual 155; full sweep
  settles green at the final tree.
