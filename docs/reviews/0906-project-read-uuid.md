# Project read route UUID validation

## Developer
GET/projects/:id applies Nest ParseUUIDPipe before service/database access.
Other controller methods unchanged. Same pipe already used on OTA project IDs.
SDK encoding and runtime untouched. Uncached API build and units34/318 pass.

## Product
Malformed project identifiers now return400 rather than500 on projects.get.
Valid project still resolves and valid absent UUID stays404. Single-route fix,
not a claim that all malformed identifiers across the API are addressed.

## Designer
API validation only, no UI/screenshot/visual claim.

## Security
Authenticated malformed requests rejected before database access; guard still
returns401 without credentials. No existence disclosure added. Tests use local
synthetic accounts/tokens. No worker/license/spend/provider/token scope/registry
change.

## QA/integration
Real HTTP baseline three malformed identifiers all returned500, failing new
400 checks. Fixed SDK79 (73prior+6) covers valid, three malformed/punctuation/
numeric, absent valid UUID and unauthenticated malformed. OTA117, browser26,
providers2/132, URL81/redirect100/startup3 and strict relative/package types/
package runtime2 pass. Docs/diff pass. No new formats/application-browser/
whole-web/Docker/external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external
gaps unchanged. Five perspectives complete before commit, no scoped issue.
