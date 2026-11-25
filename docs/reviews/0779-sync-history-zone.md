# Explicit diagnostic recorded timezone

## Developer
Recorded time label now adds displayed timezone with same locale/timezone source
as existing medium date display. Semantic time keeps exact valid source datetime;
invalid source omits attribute and retains fixed unavailable label. Date parsing
boundary matches local sort. No timestamp normalization, sort or download edit.

## Product
Removes ambiguity when reading diagnostic records across timezones. This is
recorded caller-file diagnostic time, not completed sync or verified remote time.
Equivalent UTC/offset instants display same moment, source offsets remain raw.

## Designer
Inspected desktop and390px real screenshots. Explicit GMT+2 follows medium time,
wraps with diagnostic/not-applied text, no horizontal overflow. Desktop invalid
fallback rows readable. Narrow screenshot focuses first valid records; invalid
fallback separately verified through browser/desktop. No unrelated layout edit.

## Security
Malformed timestamp never rendered as raw metadata in time label/attribute.
No provider, registration, token scope, spend, worker, sharing or license changes.
Download source and scope unchanged.

## QA and integration
-10 new units: explicit locale+zone and equivalent instant, nine invalid values.
- Original label negative1 fail/9 pass. Fixed restored.
- Affected history9 suites/101 tests pass. Initial run1 fail from old exact-medium
 expectation; updated it to intentional zone suffix, reran all affected green.
- Browser7/0: equivalent UTC/+02 display, exact datetime source/invalid omission,
 390px fit, stable equal instants/invalid last order, exact raw loaded download,
 one read/no writes, no runtime errors. Real disposable auth/API/PostgreSQL with
 intercepted diagnostic GET fixture. Final rerun after removing debug output.
- Production web/API builds, docs4/138routes, syntax/diff pass.
- No full-web/whole-product/native/sync/provider rerun claim. Coverage22 FULL/
 7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete, old formatting regression expectation updated.
