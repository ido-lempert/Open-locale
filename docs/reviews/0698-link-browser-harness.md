# Fail-closed full identity-link browser checks

## Developer
Two full link browser scripts now track completion/failures independently and
force nonzero status on incomplete execution. Exit listener preserves failed
startup when PostgreSQL cleanup awaits an already-fired event. Abort catch counts
failure. Existing default ports unchanged; process-local override supports probes.

## Product
Full link checks cannot be declared verified when startup aborts. Normal OIDC
conflict-message assertion was stale after bounded callback feedback; updated
only that expectation to fixed recovery without raw conflict detail, preserving
the database original-owner check. No application/auth/UI behavior changes.

## Designer
No application pixels or interaction changed. Full actual local provider link
flows rerun. No new screenshot or design milestone claim.

## Security
Harness invokes fixed local scripts with argument arrays, no shell. Test-only
port override stays local. No credentials, permissions, worker, account or
external-provider changes. Bounded callback expectation rejects raw conflict text.

## QA and integration
- Pre-fix OIDC-link occupied port reproduced zero-exit defect2pass/1fail.
  Both fixed startup cases6/0 check real abort, nonzero unsignalled/nontimeout
  exit and zero application PASS assertions.
- Removing only OIDC-link exit listener failed exactly exit assertion2/1;
  restored3/0. Empty filter exits1.
- Normal full OIDC-link12/0 and SAML-link55/0 after stale expectation fix.
  First OIDC normal run11pass/1fail for old raw-conflict text, not counted green.
  Includes actual local mock-provider identity binding and SAML unlink/auth
  behavior, not external IdP or whole-product/native/sync acceptance.
- Web units136files/1795tests plus136files/1572tests,272unique files/3367tests.
  API/web valid cached builds since application code unchanged. Docs138routes,
  syntax and diff checks pass.

Five review passes complete with stale test expectation fixed before commit.
Coverage22 FULL/7 PARTIAL/1 MISSING, external gaps, disabled workers and unchosen
license unchanged. No spend, registration or token-scope expansion.
