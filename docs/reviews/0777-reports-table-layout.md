# Report table spacing and keyboard scroll

## Developer
Component-scoped QA/usage/task table padding, borders and spacing; no global
style edit. Existing progress styling untouched. All four scroll groups receive
named region role, tabindex and focus-visible outline. No data methods changed.

## Product
Fixes adjacent report headers/counts running together seen in prior actual
screenshots. Loaded report totals, local filter scope and raw downloads unchanged.
Keyboard users can reach overflowing report columns without pointer dragging.

## Designer
Inspected actual desktop full-page and390px focused mobile screenshots. QA
headers/counts now separated and rows aligned; usage/actor/workload rows have
spacing and borders. Progress appearance preserved. Mobile retains internal
horizontal scroll, clips leading locale columns when scrolled far right by
intent, and has visible blue focus outline. No whole-page overflow.

## Security
Presentation-only, no read/write scope or source alteration. No provider,
registration, credential scope, spend, worker, sharing or license changes.
Download/privacy scope copy unchanged.

## QA and integration
- Affected report units7 suites/81 tests pass. No whole-web rerun claim; latest
 full web baseline710 was304 suites/3759 tests.
- Real browser15/0: previous own-count/source/download protections, four distinct
 named keyboard regions, cell spacing/borders, old-layout negative style probe
 detected then removed/restored,390px fit, ArrowRight scrolling, Tab/Shift+Tab
 return and visible focus. No API traffic from layout/filter/download work.
- Negative probe changes isolated CSS, no retained artifact/app mutation.
- Production web/API builds, docs4/138routes, syntax/diff pass.
- Real disposable auth/project/API/PostgreSQL with report state fixtures.
 No whole-product/native/sync/provider rerun claim. Coverage22 FULL/7 PARTIAL/
 1 MISSING and external acceptance gaps unchanged.

Five review passes complete, keyboard test changed to actual Tab/Shift+Tab.
