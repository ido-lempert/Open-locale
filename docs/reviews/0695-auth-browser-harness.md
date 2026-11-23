# Fail-closed authentication browser checks

## Developer
Five older browser scripts now track successful completion separately from
assertion failures, force nonzero exit for incomplete execution and increment
failures on abort. Exit listener preserves startup failure when incomplete
PostgreSQL cleanup leaves no live handles. Existing default ports unchanged;
process-local test override supports real occupied-port probes.

## Product
Login/callback/OIDC/SAML checks cannot be called verified when startup aborts
before assertions. Verification-only; no application, auth, provider or UI change.

## Designer
No application pixels or interactions change. Five normal browser paths still
exercise existing actual interface. No new screenshot or design milestone claim.

## Security
Harness invokes fixed local scripts using subprocess argument arrays, no shell.
Test-only port override stays local. No credentials, external destinations,
permissions, worker or account changes. No external IdP acceptance claim.

## QA and integration
- Before fix, actual occupied-port login lifecycle probe reproduced misleading
  zero exit:2passed/1failed. All five fixed cases pass15 assertions in two
  nonoverlapping groups, checking real abort, nonzero unsignalled/nontimeout
  exit and zero application PASS assertions.
- Removing only login lifecycle exit listener failed exactly the nonzero-exit
  assertion,2/1; restored3/0. Unmatched filter exits1.
- All five normal browser paths135/0:login configuration8, lifecycle8, callback
  handlers9, local mock-provider OIDC49 and SAML61. No whole-product browser/
  native/sync or external-provider rerun/acceptance claim.
- Web units136files/1795tests plus136files/1568tests,272unique files/3363tests.
  API/web builds use valid cache because application code unchanged. Docs138routes,
  syntax and diff checks pass.

Five review passes found no remaining issue. Standing coverage22 FULL/7 PARTIAL/
1 MISSING, external acceptance gaps, disabled workers and unchosen license unchanged.
No spend, registration or token-scope expansion.
