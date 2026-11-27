# SDK redirect status and method matrix

## Developer
Expanded real local transport regression to five redirect statuses301/302/303/
307/308, same/cross-origin targets and five helper paths including import and
translation writes. No SDK implementation change. Fake credential/data only.

## Product
Confirms intentional no-redirect contract across read/export/write methods.
Configure final API URL directly. Not a redirect-following compatibility mode.

## Designer
Transport tests only, no UI/screenshot claim.

## Security
Each redirect rejects and target receives zero requests, so neither token nor
write body arrives. Both same-origin and cross-origin guarded. No real secrets
or external destination used, no compromise/attack claim. No scope/provider/
worker/license/spend/share/registry changes.

## QA/integration
Matrix100 checks =5statuses x2origins x5helpers x2assertions, supersedes6-check
redirect probe. Mutation to redirect:follow produces90 failures (OTA still
rejects on absent digest afterward), restored SDK and100 green. Real SDK67/
URL74/startup harness3/OTA117 pass. Syntax/diff/docs pass. No build/unit/browser/
native/provider rerun claim. Latest807 API34/318,804 OTA browsers85, whole-web
797315/3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five
perspectives complete before commit, no scoped findings remain.
