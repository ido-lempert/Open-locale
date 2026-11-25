# Report/QA startup harness command and port routing

## Developer
Harness accepts only exact bare-node or reaped-node script commands. Explicit
own-entry port map covers all16 discovered report/QA browser scripts. Unknown
command or unmapped addition fails before spawning, even when filtered out.
Seven newer suites now route to their distinct occupied-port variable rather
than malformed command slicing or unused common variable.

## Product
Restores meaningful fail-closed startup coverage as browser scripts accumulate.
No new feature, product state, provider integration or acceptance claim.

## Designer
No UI/visual changes; no new screenshot claim. Console output preserves three
plain assertions per suite and helpful failure diagnostics.

## Security
Only supported local script paths are spawned via argument arrays, no shell
execution. No credentials, remote access, worker, license, sharing or spend.
Explicit unsupported-entry refusal avoids silently skipping new coverage.

## QA/integration
-16 real occupied PostgreSQL-port startup suites48/0 in two disjoint eight-suite
runs. Each child must show address-in-use/startup abort, nonzero unsignaled exit
without timeout, and no application PASS assertion.
- Initial single run hit execution window after ten suites, not counted complete.
- Forced-zero child negative exactly one intended exit assertion failure. Child
restored and rerun3/0. Unsupported command, unmapped suite and empty selection
all reject. Temporary mutations restored before review/commit.
- Negative helper initially counted PASS/FAIL substrings inside labels or JSON
instead of anchored assertion lines. Corrected verification and repeated.
- Docs consistency4 checks/138routes, syntax and diff checks pass.
- Test-only slice, no browser UI/native/sync/provider or production build rerun.
Latest full web baseline719:311 suites3783 tests. Coverage22 FULL/7 PARTIAL/
1 MISSING and external acceptance gaps unchanged.

Five review perspectives complete with scoped fixes before commit.
