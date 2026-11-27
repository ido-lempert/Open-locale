# SDK OTA optional locale scope validation

## Developer
When response has its own locale field, compare with requested locale on both
OTA helpers after digest/shape. Missing locale remains compatible with declared
minimum bundle type. Null/non-string/different supplied locale rejects.

## Product
Avoid returning explicit wrong-locale metadata under correct branch/version.
Older minimal bundle without locale stays accepted. No project/publication
response identity guarantee added;304 cannot inspect absent response body.

## Designer
SDK-only validation/error change, no UI/screenshot claim.

## Security
Uses own-field test so inherited properties cannot masquerade as metadata.
No coercion to another locale or authenticity claim. No token/provider/worker/
license/spend/sharing/registry changes.

## QA/integration
Baseline first wrong-locale case fails rejection. Error26 checks (19prior+
6invalid latest/version combinations+1matching metadata) pass. Existing minimal
and special-key fixtures prove absent locale compatibility. Real SDK73/URL81/
redirect100/startup3/OTA117 green. Syntax/diff/docs pass. No build/unit/browser/
native/provider rerun claim. Latest817 API34/318/formats269,804 OTA browsers85,
whole-web797315/3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five perspectives complete before commit, no scoped findings remain.
