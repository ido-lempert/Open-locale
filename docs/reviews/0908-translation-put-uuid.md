# Translation PUT UUID validation

## Developer
Upsert route applies ParseUUIDPipe to projectId/keyId before service/database.
Only PUT keys/:keyId/translations changed. SDK runtime unchanged. Uncached API
build and API34/318 pass.

## Product
Malformed project/key IDs return400 instead of500. Valid absent IDs stay404,
unauthenticated malformed stays401. Existing saved translation unchanged after
invalid requests. Not validation coverage for all translation-controller routes.

## Designer
API-only change, no UI/screenshot/visual claim.

## Security
Reject invalid identifiers before database access; auth guard remains first.
Local synthetic tokens/translation data only. No worker/license/spend/provider/
token scope/registry change.

## QA/integration
Baseline four malformed plain/punctuation project/key cases500 fail intended400
checks. SDK97 (89prior+8) covers those plus absent valid project/key404,
unauthenticated401 and saved translation preservation. OTA117/browser26/
providers2/132/URL81/redirect100/startup3/relative-package strict types and
package runtime2 pass. Docs/diff pass. No fresh formats/application-browser/
whole-web/Docker/external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external
gaps unchanged. Five review perspectives complete before commit, no scoped
issue remains.
