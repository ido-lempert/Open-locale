# Review 0017 - CSV import/export (API-first)

Note (0054 follow-up): an Android XML import with no `<resources>` root element is rejected 400. Before this, a non-Android XML file (for example an XLIFF document) produced a silent zero-key success; that is now fail-closed.

## Scope
CSV as a second interchange format: GET /projects/:id/export/:locale/csv (text/csv,
RFC-4180 quoting, CRLF, key,value header) and POST /projects/:id/import/:locale with
{csv} body (header optional, quoted commas/quotes/newlines, unicode), running through
the same per-key transactional import pipeline with ImportRun recovery records.
Strict on shape: rows with more than 2 columns are rejected 400.

## Pass 1 - Developer
- csv.ts pure serializer/parser, 4 unit tests (round-trip specials, header drop,
  LF/CRLF, empty values + unicode). api unit 9/9, 4 suites.
- formats suite 8/8: import w/ header + specials, export content-type + round-trip,
  headerless import, unicode export, 3-column 400, cross-team 404 both directions,
  ImportRun rows recorded.

## Pass 2 - Product
- CSV imports reuse the audited import pipeline exactly: counters, history rows,
  status reset to UNVERIFIED on changed wording, unchanged values skipped.
- Honest strictness: 3+ column rows are a 400 with a clear message instead of silent
  truncation. Header detection is exact 'key,value'.
- Empty value column imports as empty string (a real choice: CSV can clear a
  translation; documented here).

## Pass 3 - Designer
- No visual change in this slice (API-only). Editor Export/Import buttons still offer
  JSON; CSV UI controls are the next slice and will get their own visual pass.

## Pass 4 - Security
- Same membership guard (404 cross-team both directions, tested). CSV body capped at
  2MB by DTO validation; parser is a single linear scan, no regex backtracking
  (no ReDoS surface). Export sets no-store.
- Formula-injection (OWASP CSV injection) addressed before any UI ships: default
  export is spreadsheet-safe, prefixing values/keys starting with = + - @ tab CR with
  an apostrophe; mode=raw is the clearly distinguished lossless roundtrip mode.
  Tested at unit level (all six prefix families shielded, raw preserved, raw
  roundtrip lossless) and integration level (safe vs raw export of an actual
  =HYPERLINK value, verbatim import, byte-identical raw export->import->export).

## Pass 5 - QA / integration
- import-runs 15/15, formats 11/11, tm 12/12, activity 24/24, api unit 10/10 - all exit 0.
- Full loop + e2e deferred to the CSV-UI slice; no UI paths touched in this commit.

## Known gaps
- No CSV controls in the editor UI yet (next slice).
- Single-locale narrow CSV only; no multi-locale wide export.
- Safe-mode exports are for spreadsheet viewing; re-importing one keeps the
  apostrophe prefixes (verbatim import) - documented behavior, not a silent fix-up.
