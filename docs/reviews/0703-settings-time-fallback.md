# Guard loaded settings metadata timestamps

## Developer
Guarded formatter covers all four settings date usages: token creation/use,
webhook creation and publication creation. Exact valid locale date formats kept.
Null/undefined last-use means never-used; supplied invalid/empty time is unavailable.
No source normalization, endpoint, permission or form-state change.

## Product
Malformed metadata no longer prevents settings rows or controls from rendering.
Unavailable time is not a validity, expiry or delivery claim. Existing explicit
refresh and draft preservation retained. No new token, send, publish or retry path.

## Designer
Actual desktop and390px token/webhook/OTA screenshots inspected in six-view
contact sheet. Fixed labels wrap without horizontal overflow; refresh/control
context remains readable. Screenshots are scrolled sections, not full settings.

## Security
Arbitrary time content cannot become raw labels/markup. No secrets revealed,
new permissions, worker enablement, license, registration, spend or token scope
expansion. Fixtures use isolated disposable local database only.

## QA and integration
- Ten new unit tests; raw-label negative mutation failed exactly1 selected test,
  restored before273unique web files/3397tests green (136/1805 +137/1592).
- New actual browser8/0 covers three loaded lists, empty vs absent last-use,
  source preservation, no markup,390px fit, explicit refresh and retained draft.
- Existing token13/webhook14/OTA14 refresh browser checks41/0. Initial token run
  had13PASS but wrapper forced orphan cleanup and failed; rerun all three with
  NX_DAEMON=false clean. Do not count initial run as success.
- Web built/API cached. Syntax/diff and docs4/138routes pass. Existing initial
  bundle warning persists. Not whole-product/native/sync/external acceptance.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged.
