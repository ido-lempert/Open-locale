# Unknown QA filter lifecycle regression

## Developer
Explicit QA reread retains Unknown issue and literal query; clearing only search
retains unknown filter. Route departure blocks captured handlers and fresh visit
resets both filters. Direct unit tests cover reread/new-project/destruction.
No application code change. Restore temporary anchor-click download stub before
real navigation so the fixture actually exercises router lifecycle.

## Product
Unknown-only empty result names Unknown issue scope, never a clean-check claim.
New visit starts all findings; local choices are not persisted. Existing raw
full download and no-unrequested-read/write guarantees remain asserted.

## Designer
No layout/copy changes or new screenshot claim.741 desktop/mobile pixels are
last visual check. Existing labelled filter and search controls unchanged.

## Security
Captured departed handlers cannot change old choices. Raw malformed types stay
in downloaded reference; literal markup remains escaped. Exactly3 expected QA
reads (initial, explicit rerun, fresh visit), zero writes. No new external
provider/credential/worker/license/spend/share changes.

## QA/integration
- QA8 unit suites60 tests pass.
- Browser initial17PASS then navigation timeout because prior download anchor
stub still suppressed link click. Fixture now restores original method before
navigation; corrected browser20/0 exit0. No app fix or false initial pass claim.
- Existing negative label/filter probes and restoration retained. Browser uses
real local API/PostgreSQL with deterministic malformed QA response fixture.
- Docs4 checks/138routes, syntax/diff pass. Test-only, no production build/new
screenshot/whole-web/full-product/native/sync/provider/all-backend rerun claim.
Coverage22 FULL/7 PARTIAL/1 MISSING/defaultOFF/external acceptance unchanged.

Five review perspectives complete, no remaining scoped failure before commit.
