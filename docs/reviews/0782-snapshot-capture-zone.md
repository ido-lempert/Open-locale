# Explicit snapshot capture clock identity

## Developer
Medium date/time with seconds and displayed zone replaces short label. Valid
capture string retained exactly in datetime; malformed input keeps fixed fallback
without attribute. Raw restore identity, source, sorting and inventory untouched.

## Product
Nearby captured restore candidates now distinguish seconds and displayed zone.
Labels remain loaded metadata only, not content verification or current restore
permission. Restore confirmation still identifies exact raw snapshot/time and
requires normal confirmation. No restore executed by verification.

## Designer
Inspected real desktop and390px screenshots. Capture/zone line readable, wraps
below count/label on narrow rows; review disclosure and restore control remain
separate. Invalid fallback visible, no document overflow. No unrelated layout edit.

## Security
Invalid source not rendered in time label/datetime. Raw identity stays literal
in existing explicit review/confirmation. No provider, registration, credential
scope, spend, workers, sharing or license change.

## QA and integration
- New unit medium+zone/equivalent instant/distinct seconds; original short label
 negative1 fail/0 pass. Fixed restored. Existing metadata format assertions updated.
- Affected snapshots/order16 suites194 tests pass; no full-web rerun claim.
- Browser9/0: explicit seconds/zone, exact valid datetime/invalid omission,
 expanded raw identity,390px fit, cancelled restore raw ID/time no request,
 stable precision order, raw loaded nonrestorable inventory, one read/no writes,
 no runtime errors. Real disposable API/PostgreSQL, intercepted snapshot GET.
- Production web/API builds, docs4/138routes, syntax/diff pass.
- No whole-product/native/sync/provider rerun claim. Coverage22 FULL/7 PARTIAL/
 1 MISSING and external acceptance gaps unchanged.

Five review passes complete; existing valid display expectations updated.
