# Flutter ARB exact prototype-named key preservation

## Developer
ARB output used a normal object, silently omitting valid __proto__ plain and
plural entries. Use a null-prototype dictionary, then set @@locale metadata.
No parser/subset/ICU changes. Names remain flat; constructor/toString retained.

## Product
Single-locale ARB and ARB bundle entries preserve exact stored __proto__ data.
Plain and plural ICU round-trips tested. Existing metadata-ignore and explicit
lossy variable-name normalization rules remain unchanged.

## Designer
API/file-content fix only, no UI/layout or screenshot inspection claim.

## Security
Dictionary own data cannot invoke prototype setters during export. No global
prototype pollution or external attack claim. No auth/provider/worker/license,
spending/sharing/token-scope changes. All regression data local fixtures.

## QA/integration
Baseline units2 new failures/8 existing passes and actual PostgreSQL/HTTP
formats2 new failures/216 existing passes. Fixed units1suite10tests and formats
218checks pass. Real single endpoint and extracted bundle entry verified as
own data, not inherited values. API build, syntax/diff/docs pass. No browser,
whole-web/native/provider rerun claim. Existing22FULL/7PARTIAL/1MISSING/
defaultOFF/external gaps unchanged. Five review perspectives complete before
commit; no scoped findings remain.
