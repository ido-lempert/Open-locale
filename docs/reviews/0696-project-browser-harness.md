# Fail-closed project browser checks

## Developer
Nine older project list/create/draft browser scripts track completion separately
from assertion failures. Exit listener and explicit final exit preserve failures
when incomplete PostgreSQL cleanup leaves no live handles. Abort catches increment
failures. Test-only port override, existing defaults unchanged.

## Product
Project-list/create/draft checks cannot be reported successful after aborted
startup. Verification-only; no application, project or local draft behavior change.

## Designer
No application pixels or interactions changed. All nine normal actual interface
paths rerun. No new screenshot or design milestone claim.

## Security
Harness invokes fixed local script paths with subprocess argument arrays, no
shell. Test-only port override remains process-local. No credentials, permissions,
external destinations, worker or account changes.

## QA and integration
- Actual occupied-port project create reproduced false zero exit before fix,
 2pass/1fail. All nine fixed probes27/0 in three nonoverlapping groups check
  real startup abort, nonzero unsignalled/nontimeout exit, zero application PASS.
- Removing only create exit listener failed exactly nonzero-exit assertion,2/1;
  restored3/0. Unmatched filter exits1.
- Nine normal browser paths79/0: create4, search7, refresh5, reads7,
  create-unknown8, local-draft13, draft-download12, draft-reset11, validation12.
  No whole-product browser/native/sync or external acceptance claim.
- Web units136files/1795tests plus136files/1568tests =272unique files/3363tests.
  API/web valid cache hits since application code unchanged. Docs138routes,
  script syntax and diff checks pass.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external acceptance gaps, disabled workers and unchosen license unchanged.
No spend, registration or token-scope expansion.
