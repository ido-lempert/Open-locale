# SDK OTA required-field validation

## Developer
After digest and JSON checks, require object bundle, positive safe integer version,
string branch and non-array translation object with string own values. Preserve
parsed object, literal prototype-named keys, empty strings and additive fields.
No coercion or rebuilt map. No full server-response identity/schema validation.

## Product
Reject digest-matching JSON that violates SDK declared minimum bundle shape
instead of handing null/arrays/invalid values to callers. Metadata beyond the
required typed fields remains extensible.304 has no body to validate.

## Designer
SDK validation only, no UI/screenshot claim.

## Security
Structural validation is not authenticity. Digest-before-parse ordering and
redirect restriction unchanged. No token/provider/worker/license/spend/sharing/
registry changes. Test values synthetic, no private data.

## QA/integration
Baseline first invalid-shape assertion fails structured rejection. Fixed error16
checks (5prior+10invalid shapes+1valid special-key/additive case) pass. SDK73/
URL81/redirect100/startup3/OTA117 green. Syntax/diff/docs pass. No build/unit/
browser/native/provider rerun claim. Latest817 API34/318/formats269,804 OTA
browsers85, whole-web797315/3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps
unchanged. Five perspectives complete before commit, no scoped issues remain.
