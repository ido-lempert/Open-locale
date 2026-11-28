# Branch path UUID validation

## Developer
All branch-controller project/branch path IDs use ParseUUIDPipe. Name-based
body parameters unchanged. Uncached API build/API34/318 pass. SDK unchanged.

## Product
Malformed IDs400 rather than500 under owner session; absent valid IDs404/auth401
retained. Existing branches unchanged after invalid requests. Branch workflow56
passes. API-token session-only gate remains403 before route validation.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
JWT/session guards retain precedence. Local synthetic accounts/tokens only.
No worker/license/spend/provider/token scope/registry change.

## QA/integration
Baseline8 malformed500 fail intended400 checks. SDK332 (305prior+27) includes
per-slot absent404, per-route auth401/token403 and branches preservation.
Branches56/OTA117/browser26/providers2/132/URL81/redirect100/startup3/strict
relative-package types/package runtime2 pass. Docs/diff pass. No fresh
application-browser/whole-web/Docker/external claim.22FULL/7PARTIAL/1MISSING/
defaultOFF/external gaps unchanged. Five reviews complete before commit,
no scoped issue remaining.
