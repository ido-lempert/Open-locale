# Task path UUID validation

## Developer
All task-controller project/task path IDs use existing ParseUUIDPipe. Body/query
identifier validation unchanged. Uncached API build/API34/318 pass. SDK unchanged.

## Product
Malformed IDs400 instead of500; absent valid404/auth401 retained, task list
preserved after invalid requests. Existing tasks80 workflow passes.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
Auth first, malformed IDs rejected before service/database. Local synthetic
data/tokens only. No worker/license/spend/provider/token scope/registry change.

## QA/integration
Baseline6 malformed500 fail intended400 checks. SDK361 (344prior+17) includes
per-slot absent404, per-route auth401 and task-list preservation. Tasks80/OTA117/
browser26/providers2/132/URL81/redirect100/startup3/strict relative-package types/
package runtime2 pass. Docs/diff pass. No fresh application-browser/whole-web/
Docker/external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five reviews complete before commit, no scoped issue remains.
