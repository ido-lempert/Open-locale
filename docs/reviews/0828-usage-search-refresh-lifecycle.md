# Usage local query during pending read and retry

## Developer
Two new unit cases change captured query during held usage read and across
failure/retry. Latest query filters new loaded rows, never mutates byAction
or requests task data. No application change needed.

## Product
Local query remains independent of usage read lifecycle. Failed usage shows
unavailable state, not a misleading zero-match count. Successful retry restores
latest query while downloaded raw usage remains full and unfiltered.

## Designer
Existing rendered query/count/empty guidance exercised on reappearance after
retry. No UI/copy/layout change or new screenshot inspection claim.

## Security
Search remains local, literal and bounded. Raw failure content never becomes
query or loaded figures. Existing departed callback and cross-project response
checks rerun. No provider/worker/license/spend/share/scope changes.

## QA/integration
Reports8 suites104 tests pass. Project-dashboard browser25PASS/0FAIL first
attempt: pending query changes add no reads, failed report hides match count,
retry restores local query and exact full exported byAction. Existing stale
window negative/restoration and raw private-content exclusions rerun.
Docs4checks138routes, syntax/diff pass. No new build/full-web/all-backend/native/
sync/provider acceptance. Latest full-web checkpoint761313suites3847tests.
Coverage22FULL/7PARTIAL/1MISSING, defaultOFF and external gaps unchanged.
Five review perspectives complete before commit, no scoped findings remain.
