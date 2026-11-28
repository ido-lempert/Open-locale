# Glossary path UUID validation

## Developer
All glossary-controller project/term path IDs use existing ParseUUIDPipe.
Uncached API build/API34/318 pass. SDK unchanged. Review corrected test update
payload to supported notes field, not ignored description.

## Product
Malformed IDs400 rather than500, absent valid404/auth401 retained, glossary
preserved after invalid calls. Existing glossary29 workflow passes.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
Auth first, malformed IDs before service/database. Local synthetic tokens/data
only. No worker/license/spend/provider/token scope/registry change.

## QA/integration
Baseline6 malformed500 fail intended400 checks. SDK378 (361prior+17), glossary29,
OTA117/browser26/providers2/132/URL81/redirect100/startup3/relative-package strict
types/package runtime2 pass. Includes per-slot absent404/per-route auth401 and
glossary preservation. Docs/diff pass. No fresh application-browser/whole-web/
Docker/external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five reviews complete before commit, no scoped issue remains.
