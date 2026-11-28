# Webhook path UUID validation

## Developer
All webhook-controller project/hook path IDs use existing ParseUUIDPipe.
Uncached API build/API34/318 pass. SDK/service/delivery behavior unchanged.
Review corrected fixture to supported event and active property, then reran
baseline so body validation cannot mask malformed project failures.

## Product
Malformed IDs400 rather than500, absent valid404/auth401 retained. Configuration
unchanged after invalid calls. Existing webhook45 workflow passes.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
Auth first. Local synthetic tokens/fixtures only, no new remote endpoint or
dispatch. No worker/license/spend/provider/token scope/registry change.

## QA/integration
Corrected baseline8 malformed500 fail intended400 checks. SDK408 (386prior+22)
includes per-slot absent404/per-route auth401 and configuration preservation.
Webhooks45/OTA117/browser26/providers2/132/URL81/redirect100/startup3/relative-
package strict types/package runtime2 pass. Docs/diff pass. No fresh application-
browser/whole-web/Docker/external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/
external gaps unchanged. Five reviews complete before commit, no scoped issue.
