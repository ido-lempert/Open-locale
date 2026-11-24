# Bound confirmed snapshot restore receipts

## Developer
Restore receipts validate independent own count fields as nonnegative safe
integers. Missing/nonobject/array success metadata gets explicit unavailable
counts. Null success cannot throw into the uncertain-write path. Existing
confirmation, row identity and current-visit guards remain unchanged.

## Product
A successful restore response remains confirmed even when count metadata is
unavailable. A failed follow-up list read remains a separate read failure.
No retry, invented zero, extra restore or automatic recovery is added.

## Designer
Reviewed actual desktop and390px screenshots. Receipt wraps visibly above the
retained capture label and separate snapshot-read failure. No horizontal
overflow. Valid-count wording retained; missing counts explicitly unavailable.

## Security
No arbitrary object interpolation, inherited fields or extra response properties
in receipts. Existing destructive confirmation and non-replay rules unchanged.
No new services, spend, registrations, token scopes, worker or license changes.

## QA and integration
- Focused23/0; full staged web291 suites/3,632tests pass (136/1,825 +155/1,807).
- Negative probe restoring original interpolation fails exactly2 confirmed-null
  integration cases; fixed version restored before green full runs.
- Actual receipt8/identity13/search11 browser32/0. New browser argument/timing
  failures fixed before complete green rerun. Initial identity all-PASS run had
  orphan cleanup failure, excluded; daemon-off rerun exits cleanly.
- Production web build, cached API build, docs4/138routes, syntax/diff pass.
- Browser response fixtures test malformed successful metadata and failed read;
  existing identity browser verifies actual restore effects with PostgreSQL.
- Not whole-product/native/sync/external acceptance. Coverage22 FULL/7 PARTIAL/
  1 MISSING and existing external acceptance gaps unchanged.

Five review passes complete, no remaining scoped issue.
