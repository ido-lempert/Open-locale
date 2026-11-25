# Linked identity displayed timezone

## Developer
Identity medium link-time label adds displayed zone, exact valid source goes in
semantic time datetime. Invalid source omits datetime and retains fixed fallback.
No linked identity state, read generation, unlink selection or request edit.

## Product
Linked clock time is explicit across timezones; provider email still unverified
metadata. Refresh clears pending unlink and password, never unlinks. Display
change does not verify provider ownership or grant unlink permission.

## Designer
Inspected actual desktop and390px screenshots: linked time+GMT+2 readable in
identity cards with wrapping, no horizontal overflow. Provider metadata and
unlink control stay separate. Invalid row partly below screenshot viewport,
its fallback/metadata omission verified through browser assertions.

## Security
Malformed timestamp never rendered in label/datetime. Opening unlink still
requires local password; no unlink or real account mutation performed. No
provider, registration, credential scope, spend, worker, sharing or license change.

## QA and integration
- New equivalent UTC/offset+displayed-zone unit; old label negative1 fail/0 pass.
 Fixed restored, previous exact-medium expectation updated for intended suffix.
- Affected identity3 suites57 tests pass, no full-web rerun claim.
- Browser7/0: equivalent link times, exact datetime/invalid omission,390px fit,
 opening unlink password+session warning no mutation, explicit refresh clears
 selection/invalid times,3 local fixture identities remain, no runtime errors.
- First browser startup timed out before assertions, clean unchanged retry7/0.
 Real disposable API/PostgreSQL externalIdentity fixture rows, intercepted GET.
 No real provider account connection or unlink.
- Production web/API builds, docs4/138routes, syntax/diff pass.
- No whole-product/native/sync/provider rerun claim. Coverage22 FULL/7 PARTIAL/
 1 MISSING and external acceptance gaps unchanged.

Five review passes complete; old formatting assertion updated.
