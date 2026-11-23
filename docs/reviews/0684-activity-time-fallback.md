# Guard activity timestamp rendering

## Developer
Replace unguarded template DatePipe with a bounded formatter. Non-string/blank values and pipe failures return a fixed Activity time unavailable label. Valid values still use DatePipe short format with injected LOCALE_ID, preserving existing locale/timezone behavior. Loaded events, filters, cursors and download payloads are unchanged.

## Product
A malformed recorded time must not interrupt other audit rows or imply no activity. Fallback does not invent a time, repair history or imply action success. An explicit current read can replace unavailable display with valid returned times.

## Designer
Inspected actual1280px and390px screenshots after improving the test fixture to include complete translation detail. Fixed fallback fits in existing time layout; neighboring actors/actions/keys/details remain visible without horizontal overflow. No raw malformed payload is rendered.

## Security
No new endpoint, storage, permissions or external destination. Fixed bounded fallback cannot execute markup. Existing JSON inventory contract and omission of private detail remain unchanged.

## QA and integration
- Focused activity units42/0, including ten added formatter cases for malformed/non-string/blank values and exact valid DatePipe formatting.
- Nonoverlapping staged web units136files/1712tests plus136files/1548tests =272unique files/3260tests passed. Staged, not uninterrupted.
- New actual local browser/API/PostgreSQL response-interception suite6/0: malformed and empty timestamps coexist with valid neighboring rows, raw markup absent,390px layout, unchanged local search/no writes, explicit read recovery and zero runtime date-pipe errors. New harness uses explicit completion/failure guard.
- Blank-fallback negative probe failed exactly the unavailable-time assertion,5pass/1fail; restored6/0.
- Other affected browser suites: activity36, clear13, download11. Together66 assertions passed. No whole-product browser/sync/native rerun claimed.
- Real activity HTTP/PostgreSQL checks, API/web builds, docs consistency138routes, script syntax and diff checks passed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
