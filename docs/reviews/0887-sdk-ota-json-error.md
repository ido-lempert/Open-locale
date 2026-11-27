# SDK OTA malformed JSON error context

## Developer
After digest verification, JSON parse failures now throw scoped OpenLocaleError
with fixed message. HTTP status/path retained, body text not repeated. Successful
parse/digest and304 behavior unchanged. No bundle schema validation added.

## Product
Malformed successful response no longer throws bare SyntaxError without request
scope. Matching digest only proves bytes/header agree, not valid JSON or bundle
shape. No authenticity or schema acceptance claim.

## Designer
Developer error only, no UI/screenshot claim.

## Security
Digest check still precedes parse. Fixed error avoids parser excerpt of response
text. Tests use synthetic marker, not private user data. No scope/provider/
worker/license/spend/sharing/registry changes.

## QA/integration
Baseline first new malformed-body assertion fails OpenLocaleError type check.
Fixed error5 checks (3prior+2new) pass for broken JSON and HTML with matching
digest. SDK73/URL81/redirect100/startup3/OTA117 green. Syntax/diff/docs pass. No
build/unit/browser/native/provider rerun claim. Latest817 API34/318/formats269,
804 OTA browsers85, whole-web797315/3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external
gaps unchanged. Five perspectives complete before commit, no scoped findings.
