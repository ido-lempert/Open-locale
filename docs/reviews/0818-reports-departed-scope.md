# Departed report scope callbacks

## Developer
Template branch/usage-window changes now call destroyed-guarded handlers before
signal mutation or request. Live exact selected scope/read semantics retained;
no validation/defaulting or request coalescing added. Existing locale search
and independent report response fences unchanged.

## Product
Late callbacks after leaving reports cannot change captured branch/window or
clear existing feedback. Current branch reports and project usage/tasks keep
their separate scope. No new API/report-generation behavior.

## Designer
No layout/copy changes or new screenshot claim. Existing search/viewport and
independent refresh browser assertions rerun; native controls unchanged.

## Security
Guard precedes any scope mutation and read. Captured departed callbacks preserve
branch/window/feedback, no reads/writes. No provider/credentials, worker/license/
spend/share changes; no broader security audit claim.

## QA/integration
- Reports7 unit suites92 tests. Remove guards: exact departed test fails,
live control passes (1FAIL/1PASS/6skipped exit1); restore7/92 green.
- Actual locale-search/departure browser12/0 final and independent current
refresh browser10/0; production web build/docs4 checks/138routes/syntax/diff.
- Initial browser11PASS1FAIL counted navigation's legitimate project-list read
inside no-departed-callback baseline. Baseline moved after route departure/
network-idle, corrected12/0. No app correction for fixture count boundary.
- No whole-web/full-product/native/sync/provider/all-backend rerun claim.
Latest whole-web751312 suites3835 tests; coverage22 FULL/7 PARTIAL/1 MISSING/
defaultOFF/external acceptance unchanged.

Five review perspectives complete, no remaining scoped failure before commit.
