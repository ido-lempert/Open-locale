# Bound loaded snapshot counts

## Developer
Nonnegative safe integer guard for key/translation counts in row, review and
native restore confirmation. Zero valid; malformed unavailable, not coerced.
Raw loaded objects and inventory download unchanged. No readiness/state change.

## Product
Avoids false numeric counts in loaded identity review, not a current-project
restore impact scan. Restore still requires separate explicit confirmation and
existing readiness/identity guards. No capture/restore/read behavior change.

## Designer
Actual desktop/390px screenshots inspected: unavailable labels readable/wrapped
in row and expanded review, no overflow. Valid singular units supported.
Native confirmation checked by actual canceled dialog contents.

## Security
Fixed fallback text, no object coercion in selected count labels/confirmation.
Raw local metadata download unchanged. No new service, credential scope, spend,
registration, worker or license. Existing destructive guards unchanged.

## QA and integration
-14new units;289web files/3,598tests green in136/1,825 +153/1,773 stages.
- Unsafe-integer mutation failed exactly1 selected case then restored.
- New browser7/0; existing restore-identity13/metadata8/clear9 =30/0.
- Web compiled/API cached. Docs4/138routes/syntax/diff pass; existing bundle
  warning remains. Not whole-product/native/sync/external acceptance.
- Coverage22 FULL/7 PARTIAL/1 MISSING and external gaps unchanged.

All five review passes complete with no remaining scoped issue.
