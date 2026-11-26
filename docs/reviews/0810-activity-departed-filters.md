# Departed activity action and actor handlers

## Developer
Action/actor callbacks now return after destruction before changing filter
signals, matching existing search/key/order/clear guards. Live handlers still
request exact first-page scope. No request cancellation or persistence promise.
Browser restores temporary download anchor stub before actual router departure.

## Product
Late callbacks from a page already left cannot change its captured scope or
feedback. This is a narrow lifecycle fix, no current-page filter semantics,
server activity records, pagination or metadata export changes.

## Designer
No layout/copy changes or new visual claim. Existing390px metadata/search and
retained-actor browser assertions rerun; no new screenshot acceptance claimed.

## Security
Guard precedes signal mutation and fetch. Captured rows/download feedback stay
unchanged after departure and no read occurs. Existing metadata-only download,
raw-detail exclusion and fixed read errors unchanged. No external provider,
credential, worker, license, spend or sharing change.

## QA/integration
- Activity6 unit suites97 tests pass. Remove both new guards: exact departed
regression fails, live control passes (1failed/1passed/20skipped exit1).
Guards restored and all6/97 rerun green. Initial log-count matcher omitted
skipped count and stopped follow-up, source already restored; corrected matcher
then restored units/build green. Negative mutation not retained.
- Actual metadata/departure browser9/0 twice; current-page clear/recovery/
pagination browser13/0, backend activity32 assertions. Production web build
and docs4 checks/138routes/syntax/diff pass.
- No whole-web/full-product/native/sync/provider/all-backend rerun claim.
Latest whole-web743312 suites3825 tests. Coverage22 FULL/7 PARTIAL/1 MISSING/
defaultOFF/external acceptance gaps unchanged.

Five review perspectives complete, no remaining scoped failure before commit.
