# SDK explicit JSON body preservation

## Developer
Generic request now distinguishes absent undefined from supplied JSON value,
instead of using truthiness. false,0,null and empty string serialize correctly;
objects/arrays unchanged. Method/content-type contracts tested. No endpoint
schema change or claim all routes accept primitive JSON bodies.

## Product
Caller-supplied values are no longer silently omitted. Server still decides
which JSON shape is valid for each route. Undefined continues to omit body.

## Designer
SDK transport-only correction, no UI/screenshot claim.

## Security
No extra data or new destination is introduced; provided payload is transported
as requested. Redirect guard remains active. No token scope/provider/worker/
license/spend/sharing/registry changes.

## QA/integration
Baseline fast contract fails first false payload: undefined instead of JSON
false text. Fixed URL/body81 checks (74prior+7new) pass for false,zero,null,
empty text,object,array,undefined. Real SDK73/redirect100/startup3/OTA117 green.
Syntax/diff/docs pass. No build/unit/browser/native/provider rerun claim. Latest
817 API34/318/formats269,804 OTA browsers85, whole-web797315/3864.22FULL/7PARTIAL/
1MISSING/defaultOFF/external gaps unchanged. Five perspectives before commit,
no scoped findings remain.
