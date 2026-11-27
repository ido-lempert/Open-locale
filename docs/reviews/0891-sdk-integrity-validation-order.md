# SDK integrity-before-interpretation proof

## Developer
No SDK implementation change. Added matrix of malformed JSON, invalid shape and
wrong branch crossed with absent/malformed/mismatched digest. Fixed error
messages establish validation order without parsing response body first.

## Product
Caller sees integrity failure before interpreting unverified bytes as content
or scope. Confirms current order, not new authenticity guarantee.304 remains
caller-side cached-byte verification responsibility.

## Designer
SDK contract only, no UI/screenshot claim.

## Security
Integrity failure gates parse/shape/scope. Fixed errors no body excerpts. No
provider/token scope/worker/license/spend/sharing/registry changes.

## QA/integration
Error35 checks (26prior+9new) pass. Mutation moved parse/shape/scope ahead of
digest: first new absent-digest/malformed-JSON assertion failed with parse error.
Restored SDK and35 green. SDK73/URL81/redirect100/startup3/OTA117 green. Syntax/
diff/docs pass. No build/unit/browser/native/provider rerun claim. Latest817
API34/318/formats269,804 OTA browsers85, whole-web797315/3864.22FULL/7PARTIAL/
1MISSING/defaultOFF/external gaps unchanged. Five perspectives before commit,
no scoped issues remain.
