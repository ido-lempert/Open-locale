# SDK selected304 response validator

## Developer
SDK304 result now reads response ETag header instead of copying the request
expression. Same behavior as successful200 response identity. Returned type
already permits null, so no type widening. Added field contract comment.

## Product
After server support for conditional lists/strong equivalents/wildcard, SDK
must return actual selected validator, not a list or wildcard as cache identity.
If response has no ETag the result is explicitly null, not a fabricated identity.
Existing exact requests to current API keep the same ETag. No package publish.

## Designer
SDK-only metadata change, no visible UI or screenshot claim.

## Security
No authenticity or cached-byte verification claim added.304 still has no
body and caller remains responsible for verifying its cached bytes against
the returned digest.200 integrity rejection unchanged. No secrets, scopes,
workers, provider registration, license, spend or sharing changes.

## QA/integration
Real SDK+PostgreSQL+HTTP baseline failed exactly3 new assertions: list, strong
equivalent and wildcard all returned request expression. Fixed SDK20 checks
pass (16prior+4new), including absent response ETag via a response-header-only
adapter over real authenticated HTTP. Actual OTA108 checks rerun green. Both
JavaScript syntax checks, docs4checks138 routes and diff pass. No new API unit/
whole-web/browser/native/provider rerun claim. Latest API79934/318, whole-web
797315/3864. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five review perspectives complete before commit, scoped findings fixed.
