# 0052 - Flutter ARB import/export

## What landed

Flutter ARB joins JSON, CSV, Android XML, iOS strings, PO, XLIFF and
.properties in the import/export format picker, the API
(`GET /export/:locale/arb`, `POST /import/:locale` with `arb`), and
OpenAPI docs.

Subset, stated plainly: a single JSON object; keys not starting with `@`
are translatable string entries. `@@locale` and `@key` metadata objects are
accepted and ignored (standard ARB attributes); the route's locale is
authoritative. Export emits `@@locale` plus plain entries only - no
placeholder metadata round-trip. Rejected, never silently dropped: malformed
JSON, non-object documents, non-string or nested entry values, and ICU
plural/select/selectordinal messages (`{count, plural, ...}`), which this
app cannot represent. Simple placeholders like `{amount}` pass through.

Also in this commit: the .properties export header and doc 0051 wording
corrected - UTF-8 emission is explicit, and the header names the two Java
consumer contracts (PropertyResourceBundle reads UTF-8 by default since
Java 9 / JEP 226; Properties.load(InputStream) assumes ISO-8859-1 at any
version, decode explicitly). No broad "Java 9+ reads UTF-8" claim.

## Verification

- Unit (arb.spec.ts, +6): @@locale export, lossless roundtrip (quotes,
  newlines, unicode, empty, simple ICU placeholder), metadata ignored,
  non-string/nested rejection (5 shapes), ICU plural/select rejection,
  malformed JSON and non-object rejection.
- API (formats-test, +14): import with metadata (3 upserted), content-type
  and @@locale, entries carried, export-import roundtrip stable, ICU plural
  400 with keys byte-identical before/after (including the other valid
  entry in the same file), non-string 400; boundaries through the ARB path:
  branch scoping (invisible on main, present on branch, export reads the
  branch), locale grants (he-only member 403 on en, 201 on he, export en
  200), task key lock (non-admin non-assignee import skips the locked key
  with failed=1 while an unlocked key lands; locked value unchanged).
- UI (e2e-visual, +3): select ARB (Flutter), import a .arb fixture with
  metadata, summary notice names the format, key appears in the grid;
  export captured via the generated blob parses back with the entry and
  @@locale. editor-38-arb.png pixel-inspected (picker, notice and row all
  fully framed).
- Java encoding claim grounded in Oracle docs: Java 9 PropertyResourceBundle
  API note (UTF-8 default, ISO-8859-1 fallback on malformed input) and Java
  21 Properties.load(InputStream) (ISO 8859-1).

## Review pass notes

- Developer: JSON.parse is the whole parser - no regex surface; the ICU
  detector requires the comma+keyword shape so simple placeholders are not
  false-positived.
- PM: ARB is Flutter's official l10n format; the picker names it so.
- Designer: one new option row; no layout change.
- Security: fail-closed import; 2MB DTO cap matches the other formats;
  JSON.parse is safe against entity/DTD classes of attack by construction
  (there is no XML involved).
- QA/integration: unit-api 70, formats-test 82, e2e-visual 158; full sweep
  settles green at the final tree.
