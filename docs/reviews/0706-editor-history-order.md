# Stable unavailable-last editor history order

## Developer
Replaces NaN comparator with finite string-instant validation. Valid instants
sort descending, unavailable last, stable equal/unavailable ties. Sort before50
cutoff. Response objects copied as before; source arrays/values unchanged.

## Product
Malformed metadata no longer hides newer valid changes behind input prefix at
cutoff. No complete history or single-snapshot claim. Same per-locale reads and
50-row limit. Unavailable times have no inferred chronological position.

## Designer
Actual desktop and390px screenshots inspected. Updated scope text describes
ordering/ties and limits. Newest/equal/older valid values precede unavailable
rows, readable wrapped status/value/author labels without horizontal overflow.

## Security
No source repair, action, external request, permission, credential, worker,
license, registration or spend change. History remains read-only.

## QA and integration
- Eleven new tests: full instants/offsets, stable ties, unavailable variants,
  pre-epoch valid time, source preservation and50-row cutoff after ordering.
- Reversed unavailable placement mutation failed exactly1 selected cutoff test;
  restored before275unique web files/3418tests green (136/1815 +139/1603).
- New actual local browser5/0:50 leading unavailable rows plus3 valid/tied rows,
  actual50-row output, scope guidance,390px fit and explicit read-only reread.
- Existing history9/refresh9/time8 =26/0. Web built/API cached, syntax/diff and
  docs4/138routes pass. Existing bundle warning persists. No whole-product,
  native, sync or external delivery acceptance claim.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged.
