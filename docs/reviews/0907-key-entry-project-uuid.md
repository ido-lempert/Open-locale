# Key list/create project UUID validation

## Developer
GET/POST projects/:projectId/keys apply ParseUUIDPipe before service/database.
Only list/create changed. Existing valid project key workflow still passes.
Uncached API build and units34/318 pass; SDK runtime unchanged.

## Product
Malformed project identifiers on key list/create return400 rather than500.
Valid absent project remains404, unauthenticated malformed remains401. Other
key-controller endpoints not covered by this change.

## Designer
API validation only, no UI/screenshot/visual claim.

## Security
Malformed IDs rejected before database, guards retain authentication precedence.
Local synthetic accounts/keys only. No worker/license/spend/provider/token scope/
registry change.

## QA/integration
Baseline six malformed cases returned500 and failed intended400 assertions.
SDK89 (79prior+10), three malformed classes per route plus absent-valid404 and
unauthenticated401 for each, pass. OTA117/browser26/providers2/132/URL81/
redirect100/startup3 and strict relative/package types/package runtime2 pass.
Docs/diff pass. No fresh formats/application-browser/whole-web/Docker/external
claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five review
perspectives complete before commit, no scoped issue remains.
