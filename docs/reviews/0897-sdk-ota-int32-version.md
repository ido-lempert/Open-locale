# SDK OTA stored version range

## Developer
Required OTA shape now caps positive safe integer version at PostgreSQL signed
int32 maximum2147483647, matching stored publication version. Minimum1 unchanged.
No request coercion, schema or type surface change.

## Product
Digest-valid impossible stored versions reject. Valid int32 maximum remains
accepted by SDK parsing. No claim publishing can increment past maximum.

## Designer
SDK validation only, no UI/screenshot claim.

## Security
Range guard supplements shape/integrity, no authenticity claim. No provider/
token scope/worker/license/spend/sharing/registry changes.

## QA/integration
Baseline first above-int32 response fails rejection assertion. Fixed error47
checks (44prior+3new above/max-safe/valid-int32-max) pass. Strict relative/package
types/runtime2, SDK73/URL81/redirect100/startup3/OTA117 pass. Syntax/diff/docs
pass. No build/unit/browser/native/provider rerun claim. Latest827 API34/318/
formats269,830 whole-web315/3864,804 OTA browsers85.22FULL/7PARTIAL/1MISSING/
defaultOFF/external gaps unchanged. Five perspectives complete before commit,
no scoped issues remain.
