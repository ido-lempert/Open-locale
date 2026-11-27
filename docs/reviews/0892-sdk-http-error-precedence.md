# SDK HTTP error precedence proof

## Developer
No implementation change. Error contract crosses request/export/OTA with
nonJSON503, empty401 and validation-array400 responses. Status and exact scope
remain attached; HTTP errors precede OTA digest/parser interpretation.

## Product
Useful HTTP failures remain HTTP failures instead of misleading integrity or
JSON errors. Confirms existing behavior, not a new product fix.

## Designer
Developer-facing errors only, no UI/screenshot claim.

## Security
NonJSON synthetic body text is not echoed, HTTP fallback used. No real private
data, provider/token scope/worker/license/spend/sharing/registry changes.

## QA/integration
Error44 checks (35prior+9new) pass. Mutation moved OTA integrity ahead of HTTP
status handling: first new OTA503 assertion failed with missing-digest error.
Restored SDK and44 green. SDK73/URL81/redirect100/startup3/OTA117 pass. Syntax/
diff/docs pass. No build/unit/browser/native/provider rerun claim. Latest817
API34/318/formats269,804 OTA browsers85, whole-web797315/3864.22FULL/7PARTIAL/
1MISSING/defaultOFF/external gaps unchanged. Five perspectives complete before
commit, no scoped issues remain.
