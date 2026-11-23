# Timestamp type-safe local ordering

## Developer
Two comparators now require nonempty string dates before Date.parse. Rejects
numbers, arrays and objects, including objects with throwing coercion methods.
Finite valid instants, source data, stable ties and default order unchanged.

## Product
Rows labeled unavailable cannot gain a fabricated date position through implicit
coercion. No deadline edit, snapshot capture/restore, fetch or download change.
Existing local-order scope remains true; no live deadline or recovery claim.

## Designer
Actual desktop/390px snapshot and task screenshots inspected. Valid2050 row
precedes nonstring metadata; bounded labels remain. Controls fit without overflow.
Task mobile screenshot shows order/download controls, rows below viewport; not
an all-rows-at-once claim. No visual design changes.

## Security
No coercion invokes arbitrary object's conversion methods during ordering.
No new request, permission, worker, credential, license, registration or spend.

## QA and integration
-21new unit cases cover numeric/array/object/throwing-object values, blank/null
 values, stable ties, source preservation and guarded label agreement.
- Old task comparator probe failed exactly1 selected numeric case; restored
 before277unique web files/3451tests green (136/1825 +141/1626).
- New actual local browser7/0 covers numbers/arrays/objects plus valid2050 time
 on both pages, both snapshot orders,390px fit and no extra reads/writes.
- Existing task date6/snapshot metadata8/inventory download11 =25/0.
- Web built/API cached, syntax/diff and docs4/138routes pass. Existing bundle
 warning persists. Not whole-product/native/sync/external acceptance.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged.
