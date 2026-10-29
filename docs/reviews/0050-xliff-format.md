# 0050 - XLIFF 1.2 import/export


Note (0054 follow-up): a document with no `<xliff>` root element is rejected 400. Before this, a non-XLIFF XML file produced a silent zero-key success; that is now fail-closed. A valid `<xliff>` file with zero trans-units remains a legitimate empty import.
## What landed

XLIFF 1.2 joins JSON, CSV, Android XML, iOS strings and PO in the import/export
format picker, the API (`GET /export/:locale/xliff`, `POST /import/:locale`
with `xliff`), and the CLI-reachable surface, with OpenAPI docs.

Subset, stated plainly: one `<file>`, flat `<trans-unit>` entries with
`<source>`/`<target>`; the trans-unit `id` is the key. Standard XML escaping
only (quotes stay literal in element content). Unsupported constructs are
rejected, never silently dropped: `<group>` nesting, inline markup
(`<g>`, `<x/>`, `<mrk>`, `<bpt>/<ept>` et al.), `<alt-trans>`,
`<seg-source>`, binary elements, and duplicate or missing ids. Units without
a `<target>` are untranslated and skipped (reported as `untranslatedSkipped`),
so importing a source-only file cannot wipe stored values.

## Verification

- Unit (xliff.spec.ts, +7): escaped export, id-attribute escaping, lossless
  roundtrip (quotes, newlines, unicode, empty value), inline-markup rejection,
  group/alt-trans/duplicate/missing-id rejection, source-only skip,
  self-closing target as empty value.
- API (formats-test, +14): import with a source-only unit (3 upserted,
  untranslatedSkipped=1), content-type, language attributes and escaping
  (literal quotes, escaped amp/angle brackets, literal newline), export-import
  roundtrip stable, group 400 with keys byte-identical before/after, markup
  400; boundaries through the XLIFF path: branch scoping (import ?branch=
  invisible on main, present on branch, export reads the branch), locale
  grants (he-only member 403 on en, 201 on he, export en 200), task key lock
  (non-admin non-assignee import skips the locked key with failed=1 while an
  unlocked key lands; locked value unchanged).
- UI (e2e-visual, +3): select XLIFF 1.2, import a .xlf fixture through the
  file input, summary notice names the format, key appears in the grid; export
  captured via the generated blob contains the trans-unit and the unescaped
  target. editor-36-xliff.png pixel-inspected (row fully framed).

## Review pass notes

- Developer: regex linear scan in the style of android-xml.ts; attribute-less
  `<trans-unit>` matched (caught by the missing-id test); escaped-quote
  expectation corrected to literal quotes in element content (test artifact,
  not application behavior).
- PM: XLIFF is the standard TMS interchange; the picker names the version
  ("XLIFF 1.2") so nobody expects 2.0.
- Designer: one new option row in the existing picker; no layout change.
- Security: fail-closed import (any rejected unit 400s the whole request
  before mutation); linear-scan parser, no backtracking surface; 2MB DTO cap
  matches the other formats; no external entities or DTD processing (there is
  no XML parser - the scan never expands entities beyond the five standard
  escapes).
- QA/integration: unit-api 57, formats-test 52, e2e-visual 152; full sweep
  settles green at the final tree.
