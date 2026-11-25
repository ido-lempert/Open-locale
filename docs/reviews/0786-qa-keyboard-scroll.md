# Keyboard access to QA findings columns

## Developer
QA table wrapper is named region with tabindex and described arrow-scroll help.
Component focus-visible outline, no global or findings/state/download edit.
Existing filtered-empty table layout preserved.

## Product
Keyboard users can reach loaded detail column on narrow screens. Scope copy
continues to distinguish local filtering from rerunning saved checks. No change
to branch/locale, findings, editor links or download scope.

## Designer
Inspected actual desktop full-page and390px focused-detail screenshots. Brief
help readable, blue focus outline visible, detail column accessible at far-right
scroll with literal markup text. Leading columns intentionally offscreen there;
no whole-document overflow. Empty projection fit separately asserted.

## Security
Presentation/accessibility only; no new read/write/provider, registration,
credential scope, spend, worker, sharing or license changes. Existing literal
detail output and private download scope preserved.

## QA and integration
- Affected QA7 suites44 tests pass; no full-web rerun claim. Latest full baseline
719 was311 suites3783 tests.
- Real browser10/0: named/described/tabbable region, missing-tabindex negative
probe detected then restored, ArrowRight internal scroll, Tab/Shift+Tab return
and visible focus, offscreen literal detail, filtered-empty fit, exact full raw
download, one read/no mutation or rerun, no runtime errors.
- Production web/API builds, docs4/138routes, syntax/diff pass.
- Real disposable API/PostgreSQL with intercepted QA GET. No whole-product/
native/sync/provider rerun claim. Coverage22 FULL/7 PARTIAL/1 MISSING and
external acceptance gaps unchanged.

Five review passes complete; no remaining scoped issue.
