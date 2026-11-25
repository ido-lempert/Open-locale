# Settings clock timezone labels

## Developer
Existing validated label helper adds displayed timezone only to short/medium
clock-bearing formats. Deliberate mediumDate token/webhook creation labels
unchanged. No source timestamp normalization, null handling or request edit.

## Product
Token last-use and OTA publication clock times no longer omit displayed zone.
Never-used remains only null/undefined last-use, invalid supplied last-use stays
unavailable. Date-only creation labels remain date-only intentionally. No claim
of token validity, current publication availability or delivery.

## Designer
Inspected token and OTA labels at desktop/390px. Zone suffix wraps with last-use
or publication line; scope and controls remain readable without document
overflow. Screenshots scrolled to each label with existing sticky header.
No unrelated date-style or form-layout change.

## Security
Invalid input remains fixed unavailable text. No token/secret values displayed
by tests, no credential scope/registration/provider/spend/worker/sharing/license
change. Metadata refresh does not create/revoke tokens or publish bundles.

## QA and integration
-3 new units: short/medium zone and equivalent instants, deliberate date-only.
- Old helper negative2 fail/1 pass, fixed restored.
- Affected fallback/zone/token-refresh/OTA-refresh4 suites32 tests pass; existing
 valid-format expectation updated only for intended clock suffix.
- Real browser8/0: clock zones, date-only unchanged, token+OTA390px fit, invalid
 last-use vs never-used, null last-use retained, unsaved general draft/no write,
 unchanged source timestamp, no runtime errors. Real disposable API/PG fixtures,
 intercepted token/webhook/publication metadata GETs. No external changes.
- Production web/API builds, docs4/138routes, syntax/diff pass.
- No full-web/whole-product/native/sync/provider rerun claim. Coverage22 FULL/
 7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete; date-only format kept deliberately unchanged.
