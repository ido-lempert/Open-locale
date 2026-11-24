# Clear combined diagnostic preview history filters

## Developer
One guarded handler clears search and recorded attention only. Loaded records,
project, time order, loading/error/download feedback stay unchanged. Whitespace
text counts as clearable. Captured departed handler refuses private state change.

## Product
Explicit escape from combined no-match view without fresh read or lost order.
Individual resets remain. No refresh, download, label verification or apply.
Diagnostic-only caveats remain; failed read cannot become successful empty view.

## Designer
Inspected actual desktop/390px screenshots. Reset adjacent to match count with
linked local-only scope. Button and guidance readable; cards wrap without
horizontal overflow. Disabled when neither filter is set.

## Security
No new API or download side effects, external request, credential, scope, spend,
registration, worker or license change. Handler guarded after departure. Private
loaded metadata remains in the same local snapshot, with existing access checks.

## QA and integration
-4new units;284web files/3,525tests green in136/1,825 +148/1,700 stages.
- Missing attention-reset mutation rejected by exactly1 selected case, restored.
- New browser9/0; existing attention10/order11 =21/0.
- First whitespace assertion raced render. Explicit input event/settle wait fixed;
  all-PASS rerun failed orphan cleanup. Child Nx daemon disabled; clean rerun9/0.
- Web compiled/API cached. Existing bundle warning remains. Docs4/138routes and
  syntax/diff pass. No whole-product/native/sync/external acceptance claim.
- Coverage22 FULL/7 PARTIAL/1 MISSING and standing external gaps unchanged.

All five review passes complete with no remaining scoped issue.
