# Backend storage/format/preview unit checkpoint

## Developer
Full current API unit inventory33 suites290 tests pass after OTA storage and
format/import preview corrections. Affected editor import units2 suites26
tests pass. No implementation changes needed.

## Product
Actual PostgreSQL/HTTP formats269 and OTA76 checks pass,345 combined checks.
Covers retained release/payload rollback, version boundary, exact special-name
keys, format dispatch and plural/template preview corrections. No full-product
or external-provider acceptance claim.

## Designer
No UI/layout change or new screenshot inspection claim. Prior793 supplies
inspected real editor preview screenshot, not rerendered in this checkpoint.

## Security
API units include existing auth/format/GitHub/parser checks; live local HTTP
suites retain grants, task locks, immutable identity and archive protections.
No worker/provider/license/spending/sharing/credential-scope changes.

## QA/integration
All selected runs first-attempt green. API/web builds, syntax/diff/docs4checks
138routes pass. No new browser/whole-web/native/provider rerun claim. Latest
import-scope browser79411 assertions; whole-web772315/3863. Existing22FULL/
7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five review perspectives
complete before commit; no scoped findings remain. Docs-only checkpoint.
