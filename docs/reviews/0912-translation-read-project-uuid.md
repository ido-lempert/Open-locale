# Translation read helper project UUID validation

## Developer
ZIP export, TMX export, TM suggest and import-run list apply existing
ParseUUIDPipe before service/database. Bulk status/ZIP import unchanged.
Uncached API build and API34/318 pass. SDK runtime unchanged.

## Product
Malformed project IDs return400 instead of500 on these four reads. Valid
absent404 and unauthenticated401 retained. Formats269/TM18 valid behavior pass.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
Malformed IDs stop before database, auth remains first. Local synthetic tokens/
data only. No worker/license/spend/provider/token scope/registry change.

## QA/integration
Baseline8 plain/punctuation malformed requests500 failed intended400 checks.
SDK184 (168prior+16) includes those plus absent404/auth401 per route. Formats269,
TM18, OTA117/browser26/providers2/132/URL81/redirect100/startup3/relative-package
strict types/package runtime2 pass. Docs/diff pass. No new application-browser/
whole-web/Docker/external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps
unchanged. Five reviews complete before commit, no scoped issue remaining.
