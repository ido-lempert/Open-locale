# Review 0018 - CSV editor UI + escape hardening

## Scope
Editor CSV controls (Export CSV (spreadsheet-safe) button, Import CSV file input,
visible note distinguishing spreadsheet-viewing exports from lossless mode=raw
roundtrips, post-export/import notices), plus escape hardening: formula-prefix
detection now skips leading whitespace/control characters, and a delimiter/quote/
newline breakout roundtrip test.

## Pass 1 - Developer
- api unit 10/10 (padded-prefix and breakout cases), formats integration 12/12
  (leading-whitespace formula shielded end to end), e2e-visual 40/40 exit 0 with 3
  CSV UI checks. Stale-dist miss caught during the round (built web only, formats
  suite runs the API dist) - rebuilt and reran, rule re-confirmed.

## Pass 2 - Product
- Export button is explicitly labeled spreadsheet-safe; the toolbar note states the
  consequence (re-importing a safe export keeps prefixes and changes stored values)
  and names mode=raw for lossless roundtrips. Same text in the post-export notice.
- CSV import flows through the audited pipeline with the existing summary notice.

## Pass 3 - Designer
- editor-20-csv.png inspected: buttons and note readable, import notice green,
  imported key visible, glossary pills styled. No secrets.

## Pass 4 - Security
- Verified claims only: prefixes = + - @ after any leading whitespace/control run,
  plus standard quoting for delimiter/quote/newline, covered by unit + integration
  tests. No claim about every spreadsheet app's parsing quirks.
- UI now states the stored-value consequence at the point of export AND import.

## Pass 5 - QA / integration
- formats 12/12, e2e 40/40 exit 0; full loop deferred to next feature round.

## Known gaps
- No multi-locale wide CSV export; no Android XML / iOS strings formats yet.
