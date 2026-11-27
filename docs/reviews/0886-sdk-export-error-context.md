# SDK export error scope context

## Developer
exportText builds requested path once, retains it in OpenLocaleError and uses
same array-message joining/fallback as generic request. Successful raw text
unchanged. Export helper is now async, invalid path inputs reject its promise;
other helpers retain previous synchronous local validation behavior.

## Product
Export failures identify project/locale/format/branch actually requested rather
than a shortened path without project or branch. Validation messages readable
with same separator as other SDK requests. No schema/registry change.

## Designer
Developer-facing error context only, no UI/screenshot claim.

## Security
No new destination or automatic disclosure. Error carries caller-supplied scope,
not credentials. Redirect guard stays active. No token scope/provider/worker/
license/spend/sharing change.

## QA/integration
Baseline isolated export test fails exact path assertion, missing project/branch.
Fixed error3 checks pass for string/list/absent message and full path. URL/body81,
real SDK73, redirect100, startup3, OTA117 green. Syntax/diff/docs pass. No build/
unit/browser/native/provider rerun claim. Latest817 API34/318/formats269,804 OTA
browsers85, whole-web797315/3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps
unchanged. Five perspectives complete before commit; no scoped findings remain.
