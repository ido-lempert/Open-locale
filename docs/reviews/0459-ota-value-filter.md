# 0459 Filter retained OTA values

## Developer review
Local exact empty/non-empty filter intersects existing literal case-insensitive
key/value search. Empty is exactly '', not whitespace or zero. No-filter fast
path keeps row-array identity. Filter changes reset pagination; page count and
navigation use filtered rows. Invalid/departed handlers refuse changes. Current
refresh retains filter, any route/publication visit resets it. Full source rows
and all-loaded retained-locale JSON export remain unchanged. No API/schema change.

## Product review
Retained-only scope says empty does not mean missing keys, live-editor QA or
client delivery. Explicit Clear value/search and combined no-match guidance keep
an empty filtered view distinct from an empty published locale. Download includes
all retained values regardless of both filters and page; no newer-live-state,
publishing or delivery claim. Existing pin/legacy identity behavior unchanged.

## Design review
Final desktop/390px screenshots inspected: value select, Clear controls, exact
empty/whitespace scope, full-download notice, count and no-match guidance readable
without document horizontal overflow. Existing full-width input/select wrapping
works without new CSS. No pixel correction needed.

## Security review
Filtering creates no network requests/writes/HTML interpretation or external
service access. Existing read/error/departed download and publication identity
checks unchanged. Exact allowed filter values, destroyed check and read lifecycle
prevent stale visit/filter changes. No spend, registration, worker enablement,
dependency or credential changes. Owner upload/live repository checks separate.

## QA/integration review
New unit4/web947 in89 suites/API265 in31/builds0 (unchanged API build cached).
New browser initial10PASS/1FAIL sampled refresh before its request/current render;
fixture now waits for search count and observed refresh request before sampling,
final11/0. No app change for that failure. Real retained51 values include two
empties, whitespace and zero, with newer live edit excluded. Proves last-page
reset, search intersection, filtered-empty guidance, full file despite no matches,
zero filtering effects, Clear, explicit refresh retention, query-only route reset,
departed handler and runtime-error check. All API groups/86 isolated browser
suites final0. Separate sync95+144=239unique/native116+111+19=246total242unique/
four startup repeats all inner/outer0. Config16/14/docs4-138routes/reaper4 all0.
Completed successful checks preserved across continuation, no uninterrupted claim.
Coverage22FULL7PARTIAL1MISSING and automation defaultOFF unchanged.
