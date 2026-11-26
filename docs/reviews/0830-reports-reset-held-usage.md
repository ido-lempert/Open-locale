# Reset local searches during held usage completion

## Developer
Async unit holds actual loadUsage promise, resets queries, checks pending
loading and sibling identity unchanged, then resolves. Cleared query stays
cleared and all loaded action codes show. No app change needed.

## Product
Reset is local even during refresh. Completion does not reintroduce earlier
query. Browser actual download contains all raw actions after reset. A new
explicit query after completion still filters locally.

## Designer
No layout/copy changes or screenshot inspection claim. Actual existing reset
control exercised while usage search input is hidden by loading.

## Security
Reset neither cancels nor starts reads, changes branch/window, nor changes
loaded sibling task figures. Existing export/private-content and departed
checks rerun. No worker/provider/license/spend/share/scope change.

## QA/integration
Reports9 suites109 tests pass. Project-dashboard browser29PASS/0FAIL final,
including two new reset/held-completion assertions and existing deliberate
stale-window detection/restoration. Initial browser startup could not ready
web4200 before timeout, no application PASS; cleanup verified and same command
retry completed29/0 exit0. No product fix or invented root-cause claim.
Docs4checks138routes, syntax/diff clean. No build/full-web/all-backend/native/
sync/provider acceptance claim. Latest full-web761313suites3847tests.
Coverage22FULL/7PARTIAL/1MISSING, defaultOFF/external gaps unchanged.
Five review perspectives complete before commit, no scoped findings remain.
