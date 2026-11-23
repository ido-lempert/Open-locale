# Guard diagnostic history timestamps

## Developer
Bounded formatter replaces unguarded DatePipe. Non-string/blank values and formatting failures return Recorded time unavailable. Valid values still use medium format with injected LOCALE_ID and existing timezone behavior. Records, filters, summaries and download payloads are untouched.

## Product
Malformed recorded metadata must not interrupt neighboring diagnostics or imply no history. No invented time, repaired record, applied sync, verified remote state or accepted baseline. Explicit reread can recover valid display.

## Designer
Inspected actual1280px and390px screenshots. Fallback wraps within existing cards beside the diagnostic-only label. Fingerprints and caller SHA remain wrapped. No horizontal overflow or raw malformed timestamp.

## Security
No new endpoint, permissions, storage or external destination. Fixed label cannot execute markup. Translation text remains absent from history. No additional read or write during local search.

## QA and integration
- Focused history units14/0, including ten added invalid/non-string/blank and exact valid locale formatter checks.
- Nonoverlapping staged web units136files/1712tests plus136files/1568tests =272unique files/3280tests passed. Staged, not uninterrupted.
- New real browser/API/PostgreSQL response-interception suite6/0: invalid/empty timestamps with valid neighboring record, no raw payload or translation text,390px layout, local search without requests and explicit read recovery without writes. New harness retains explicit completion/failure guard.
- Blank-fallback negative probe failed exactly intended unavailable-time assertion,5pass/1fail; restored6/0.
- Other affected history browsers: baseline6, search7, download10, attention10. Total39 affected browser assertions passed. Existing API used throughout real browser fixtures; standalone full sync-preview API/sync/native suites not rerun for this presentation-only change.
- API/web builds, docs consistency138routes, script syntax and diff checks passed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
