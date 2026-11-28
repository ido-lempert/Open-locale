# Project member path UUID validation

## Developer
Member list/add/update/remove use ParseUUIDPipe for project id; update/remove
also userId. Group routes unchanged. Uncached API build/API34/318 pass.
SDK runtime unchanged.

## Product
Malformed project/user path IDs400 rather than500. Valid absent project/user404
and unauthenticated401 retained. Member roles/list unchanged after invalid
requests. Permissions50 integration green.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
Auth guard first. Owner JWT used for probes, so API-token authorization cannot
mask malformed-ID behavior. Local synthetic data only. No worker/license/spend/
provider/token scope/registry change.

## QA/integration
Baseline12 malformed500 fail intended400 checks. SDK274 (251prior+23) includes
absent404/auth401 and member-role preservation. Permissions50/OTA117/browser26/
providers2/132/URL81/redirect100/startup3/relative-package strict types/package
runtime2 pass. Docs/diff pass. No fresh application-browser/whole-web/Docker/
external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five reviews complete before commit, no scoped issue remaining.
