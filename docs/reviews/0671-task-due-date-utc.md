# Consistent UTC task due-date display

## Developer
Explicit UTC in the existing Angular date pipe replaces browser-local formatting for task rows. The time element retains the exact stored ISO timestamp in datetime. No mutation, read, sort, filter or export logic changes. Untouched task dates still retain the original full timestamp including milliseconds. The existing calendar editor and row now agree.

## Product
Review after due-date editing found a real inconsistency: a midnight UTC date could appear as the previous calendar day west of UTC. Rows now explicitly say UTC, matching the editor's stated date semantics. This does not add time-of-day editing or change deadlines in storage. Rows without a due date still omit the time element.

## Designer
Inspected actual desktop and 390px mobile screenshots in an emulated Los Angeles timezone. UTC labels fit both the desktop row and wrapped mobile controls without collision or cutoff. The due date remains beside its own task and distinct from status and assignment controls. Full ISO datetime remains machine-readable rather than adding a second long timestamp to each row.

## Security
Display-only change, no new network destination, side effect or permission path. datetime uses Angular attribute binding, not HTML insertion. Existing scoped writes, unknown-result blocking and loaded-object guards are unchanged. The test's timezone emulation affects the isolated test browser only, not owner settings or production state.

## QA and integration
- Feature browser 22/0 initial, restored and affected regression. Real API/PostgreSQL tasks include just-after-midnight and just-before-midnight UTC timestamps. Both must show Dec 12 in Los Angeles, Tokyo and UTC, with exact full datetime attributes. Date saving and clearing are also checked west of UTC.
- Negative probe removed only the explicit UTC pipe argument. Exactly three timezone assertions failed: western boundary, eastern boundary and newly saved midnight date. 19 pass/3 fail, exit 1. Restored source reran 22/0.
- All 16 affected task browser suites passed, 191 explicit PASS assertions. Baseline task suite also completed normally in this run.
- Nonoverlapping web stages 136 files/1681 tests plus 136 files/1526 tests =272 unique files/3207 tests. Staged, not one uninterrupted run. No added unit spec because the change is template-only and the actual multi-timezone browser assertions are the relevant regression boundary.
- Real task API/PostgreSQL 80/0; API/web build, docs consistency 4/138 routes, script syntax and diff checks passed.
- No whole-product browser/sync/native rerun claimed.

Five review passes found no remaining issue. Standing external-acceptance gaps, 22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license are unchanged. No spend, registration or token-scope expansion.
