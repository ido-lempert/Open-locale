# Reports integration checkpoint after scope and export guards

## Developer
Seven reports suites94 tests pass. All seven reports browser commands were
run against built API and embedded PostgreSQL,91 application assertions total:
refresh18, branch download6, project download13, locale search12, locale
metadata12, own-count9, table-layout21. No application/test code changes here.

## Product
Branch reports stay separate from project dashboards. Window refresh and
export retain loaded scope, captured cutoffs, and independent database-read
wording. Local search does not reduce downloaded raw report scope.
Backend report HTTP/PostgreSQL checks118 pass including auth boundaries.
This is reports coverage, not whole-product or external acceptance.

## Designer
Inspected actual desktop924x1243 and focused mobile390x844 layout images.
Desktop grouping and independent dashboard explanations remain readable.
Mobile focused quality table intentionally clips inside its horizontal scroll
region; blue focus outline and surrounding explanatory text stay in viewport.
No layout/copy changes or new feature claim.

## Security
Seven reports-only occupied-port harness cases21 checks pass: startup aborts
remain nonzero with no application PASS count. Tests use local data and no
external providers. No credentials/scopes/workers/license/spend/share changes.

## QA/integration
API and web builds succeed from cache. Docs4 checks138routes, syntax/diff clean.
Initial oversized multi-browser invocation exceeded execution budget during
locale-search startup; cleaned its orphan web/browser descendants. Stale
PostgreSQL socket lock blocked restart. An initial override used the wrong
variable and did not change the port. Correct REPORT_QA_BROWSER_TEST_PG_PORT
with free port55992 completed12/0 and explicit exit0. First three browser
commands rerun individually to capture explicit exit0, all green.
A mixed report/QA harness invocation was interrupted after21 checks, so no
complete mixed-harness claim. Reports-only harness rerun completes21/0.
No unresolved product failure. Future browser batches should stay bounded.
Latest whole-web checkpoint remains751312 suites3835 tests. No full-web,
all-backend/native/sync/provider acceptance rerun. Coverage22FULL/7PARTIAL/
1MISSING, workers defaultOFF, existing external acceptance gaps unchanged.

Five review perspectives complete before commit. Checkpoint is docs only.
