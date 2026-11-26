# OTA browser harness complete command inventory

## Developer
Replaces four hard-coded startup cases with discovery of all six OTA browser
package commands. Exact named-script and PG override validator reused. Missing
mapping or unfamiliar shape fails closed before cases. Filter remains optional.
Adds fast npm run test:ota-browser-preflight with exact expected labels.

## Product
Search-metadata and value-types startup failures now covered, formerly omitted.
This verifies test harness failure semantics, not product browser success or
publication delivery. Settings OTA flows remain separate by explicit prefix.

## Designer
No UI/copy/layout changes or screenshot inspection claim.

## Security
Exact path/override binding, no shell evaluation. Real same-port bundle-command
alias mutation rejected before any case; restored. Existing report preflight
still10/0. No provider/worker/license/spend/share/scope changes.

## QA/integration
New preflight3/0: exact6 entries, filtered2 formerly omitted, no-case failure.
Restored3/0 after alias mutation. All6 actual occupied-port startup flows18
checks pass across bounded2+4 subsets, including no false application PASS,
nonzero clean exit and real occupied-port diagnostics. Docs4checks138routes,
syntax/diff pass. No app build/unit/full-web/backend/product browser success/
native/sync/provider acceptance claim. Coverage22FULL/7PARTIAL/1MISSING,
defaultOFF and external gaps unchanged. Five perspectives complete before
commit, no scoped findings remain.
