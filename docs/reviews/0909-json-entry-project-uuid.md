# JSON import/export project UUID validation

## Developer
JSON export/import entry routes apply existing ParseUUIDPipe to projectId.
Import covers both live and dryRun paths before service/database access.
SDK runtime unchanged. Uncached API build and API34/318 pass.

## Product
Malformed project IDs return400 rather than500. Valid absent UUID404 and
unauthenticated401 preserved for export/live import/preview. Existing saved
translation preserved. Other format-specific routes unchanged.

## Designer
API-only change, no UI/screenshot/visual claim.

## Security
Authentication precedes validation and malformed IDs never reach service.
Local synthetic test tokens/data only. No worker/license/spend/provider/token
scope/registry change.

## QA/integration
Baseline six malformed requests returned500 and failed intended400 assertions.
SDK110 (97prior+13) proves those, three absent-valid404, three unauthenticated401
and saved data preservation. Formats269/OTA117/browser26/providers2/132/URL81/
redirect100/startup3/relative-package strict types and package runtime2 pass.
Docs/diff pass. No new application-browser/whole-web/Docker/external claim.
22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five perspectives
complete before commit with no scoped issue remaining.
