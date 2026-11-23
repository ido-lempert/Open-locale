# Fail-closed Reports and QA browser checks

## Developer
Nine Reports/QA browser scripts now share explicit completion and recorded-failure guards. Unfinished execution or failures force nonzero status even when embedded PostgreSQL startup cleanup awaits an already-fired event. Normal completion preserves assertion count results. Default ports stay unchanged; a test-only override supports actual occupied-port checks.

## Product
Reports, QA findings and their filters/downloads cannot be treated as verified when startup fails before assertions. Verification-only: no dashboard totals, scope, finding, download or project behavior changes.

## Designer
No application pixels or interactions changed. All nine normal success paths still run against the actual interface. No new screenshot claim for this slice.

## Security
Harness discovers local package scripts and invokes direct subprocess arguments without a shell. Port overrides stay process-local. No credentials, permissions, external destinations, workers or account changes.

## QA and integration
- QA-search occupied-port probe reproduced the original misleading zero exit before the fix,2pass/1fail.
- All nine unique occupied-port cases passed27 assertions in three nonoverlapping bounded groups. Each checks actual startup abort, nonzero unsignalled/non-timeout exit and zero application PASS assertions. Unmatched filter exits1.
- Removing only QA-search exit protection reproduced exactly the nonzero-exit assertion failure,2pass/1fail; restored3/0.
- All nine normal browser paths passed94 assertions: reports-refresh10, QA-branches10, QA21, reports-download6, QA-type7, QA-download6, QA-search10, reports-project-download13, reports-locale-search11. No whole-product browser/sync/native rerun claimed.
- Nonoverlapping staged web units136files/1722tests plus136files/1568tests =272unique files/3290tests passed. API/web builds reused valid cached outputs because application code is unchanged. Syntax, docs consistency138routes and diff checks passed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
