# OTA complete quoted weak ETag

## Developer
Actual HTTP validator began W/ followed by opening quote but lacked closing
quote. Added missing delimiter without changing project/branch/version/locale/
content discriminator. Exact conditional comparison still uses current value.

## Product
OTA responses now carry complete quoted weak ETag syntax. Existing cached
malformed validators will miss once and receive200 with corrected validator;
no payload change or data migration. Existing body digests unchanged.

## Designer
HTTP metadata-only correction, no UI/layout/screenshot inspection claim.

## Security
Authorization/pin validation still precedes304. Unique scope discriminator and
private cache behavior unchanged. No auth/provider/worker/license/spending/
sharing/credential-scope changes. No external incident claim.

## QA/integration
Baseline actual PostgreSQL/HTTP fails exactly new quoted-validator assertion.
Fixed OTA82 checks =81prior+1new pass, including304/digest, scope uniqueness,
revocation/removal, duplicate query and payload rollback coverage. API build,
syntax/diff/docs pass. No browser/whole-web/native/provider rerun claim. Latest
whole-web797315/3864. Existing22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps
unchanged. Five reviews complete before commit; no scoped findings remain.
