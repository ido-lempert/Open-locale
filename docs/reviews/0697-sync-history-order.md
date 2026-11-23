# Loaded diagnostic recorded-time order

## Developer
Local loaded/newest/oldest signal composes with existing search/attention.
Sort copies rows and compares full parsed instants including offsets/subseconds.
Stable equal-time and unavailable-last order in both directions. Refresh retains
order; different project resets it. Invalid/departed handlers do nothing.

## Product
Scope guidance limits this to loaded diagnostic metadata, never applied syncs,
verified remote labels or accepted baselines. No additional read/write implied.
Source/download order remains unchanged. Default loaded order unchanged.

## Designer
Visually inspected desktop and390px screenshots. Native labeled select and scope
wrap without overflow; desktop shows oldest record first, mobile focuses on
controls/guidance rather than claiming all records fit one viewport.

## Security
No mutation, new endpoint, stored preference, permission or external destination.
Existing diagnostic/download whitelist and timestamp fallback unchanged.

## QA and integration
- Four new unit cases cover precision, offsets, ties, unavailable values, source
  nonmutation, search/attention, refresh/project reset and invalid/departed guards.
- Reversed oldest comparator failed exactly1 selected test, restored. Short first
  unit command timed out, not counted green; source restoration checked and stage
  rerun. Final136files/1795tests plus136files/1572tests,272unique files/3367tests.
- New actual browser11/0 uses real API-seeded diagnostic IDs and deliberately
  intercepted timestamp/count responses. Checks full order, combined filters,
  download original values/order, refresh/project reset, no writes and390px fit.
- Existing history6/search7/attention10/download10/time6 =39/0 browser checks.
  Web compiled; API dependency valid cache. Docs138routes, syntax/diff pass.
  Existing bundle warning persists. No whole-product/native/sync/external
  acceptance claim.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged. No spend,
registration or token-scope expansion.
