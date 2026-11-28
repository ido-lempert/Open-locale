# QA and activity project UUID validation

## Developer
QA/activity GET use existing ParseUUIDPipe for projectId. Activity query filter
validation unchanged. Uncached API build/API34/318 pass. SDK unchanged.

## Product
Malformed IDs400 rather than500, absent valid404/auth401 preserved. Existing
QA23/activity32 workflows pass. No read data shape change.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
Auth first, malformed project IDs before service/database. Local synthetic
tokens/data only. No worker/license/spend/provider/token scope/registry change.

## QA/integration
Baseline4 malformed plain/punctuation500 fail intended400 checks. SDK386
(378prior+8), QA23/activity32/OTA117/browser26/providers2/132/URL81/redirect100/
startup3/strict relative-package types/package runtime2 pass. Includes per-route
absent404/auth401. Docs/diff pass. No fresh application-browser/whole-web/Docker/
external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five reviews complete before commit, no scoped issue remaining.
