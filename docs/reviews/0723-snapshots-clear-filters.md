# Clear combined snapshot inventory filters

## Developer
Guarded handler clears only local search/kind. Keeps loaded records, project,
time order, label draft, feedback and all pending/unknown mutation state. Raw
whitespace stays clearable. Captured departed handler refuses private changes.

## Product
Explicit escape from combined no-match view without changing snapshot data or
capture form. Existing individual clears remain. No refresh/download/capture/
restore or unknown-outcome confirmation. Recovery still needs explicit read.

## Designer
Inspected actual desktop and390px screenshots: reset and linked scope readable,
no document overflow, inventory rows retained. Disabled with neither choice.
Guidance separates local display from capture/restore and unknown outcomes.

## Security
No new service, read/write/download, credential scope, spend, registration,
worker or license change. Captured handler guarded after departure. Existing
restore confirmation/readiness and mutation replay guards unchanged.

## QA and integration
-4new units;285web files/3,529tests green in136/1,825 +149/1,704 stages.
- Missing-kind-reset mutation rejected by exactly1 selected case then restored.
- New real browser9/0; existing kind12/restore-unknown4/capture-unknown7 =23/0.
- Failed-list browser branch uses explicit component-state fixture, not a new
  claimed server failure check; original unknown-outcome suites cover real reads.
- Web compiled/API cached. Docs4/138routes/syntax/diff pass; existing bundle
  warning remains. Not whole-product/native/sync/external acceptance.
- Coverage22 FULL/7 PARTIAL/1 MISSING and standing external gaps unchanged.

All five review passes complete with no remaining scoped issue.
