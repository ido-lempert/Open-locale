# Group path UUID validation

## Developer
Group list/create/update/delete/member add/remove apply ParseUUIDPipe to all
UUID path identifiers. All UUID path IDs in projects controller now validated;
locale code/body/query identifiers are not part of that claim. Uncached API
build/API34/318 pass. SDK unchanged.

## Product
Malformed IDs400 rather than500. Missing valid project/group404 retained;
missing valid user on member-add remains400, member-remove404. Auth401 preserved.
Groups and memberships unchanged after rejected calls.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
Owner JWT probes prevent token-scope denial masking route behavior. Auth remains
first. Local synthetic data only. No worker/license/spend/provider/token scope/
registry change.

## QA/integration
Baseline12 malformed500 fail intended400 checks. SDK305 (274prior+31), groups44,
OTA117/browser26/providers2/132/URL81/redirect100/startup3/relative-package strict
types/package runtime2 pass. Each UUID slot tested malformed and absent, each
route auth401 plus group preservation. Docs/diff pass. No new application-
browser/whole-web/Docker/external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/
external gaps unchanged. Five reviews complete before commit, no scoped issue.
