# Fail-closed retained OTA browser checks

## Developer
Three older bundle/download/value-filter browser scripts track completion apart
from failures and preserve failed startup through an exit listener and explicit
final status. Abort catches count failure. Default ports unchanged, local test
override added. Existing timestamp suite already guarded and remains unchanged.

## Product
Aborted verification cannot count as a successful retained-bundle inspection or
download/filter check. No application, publication, client or UI behavior change.

## Designer
No application pixels or interactions change. All four normal actual interface
paths rerun. No new screenshot or design milestone claim.

## Security
Fixed local script paths invoked through subprocess argument arrays, no shell.
Port overrides are process-local. No credentials, permission, worker, account,
external destination or client-delivery change.

## QA and integration
- Pre-fix bundle occupied-port probe reproduced false zero exit2pass/1fail.
  All four startup paths12/0 in two nonoverlapping groups: real abort, nonzero
  unsignalled/nontimeout exit, zero application PASS assertions.
- Removing only bundle exit listener failed exactly exit assertion2/1;
  restored3/0. Unmatched filter exits1.
- All four normal paths53/0:bundle25/download9/value-filter11/time8.
  No whole-product/browser-native/sync/client-delivery acceptance claim.
- Web units136files/1805tests plus136files/1572tests =272unique files/3377tests.
  API/web valid cached builds because application code unchanged. Docs138routes,
  syntax/diff pass.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged. No spend,
registration or token-scope expansion.
