# Bulk status and ZIP import project UUID validation

## Developer
Last two translation-controller projectId parameters now use ParseUUIDPipe:
bulk status and ZIP import. Every projectId/keyId path parameter in this
controller now validated. Body/query identifiers not included in that claim.
Uncached API build/API34/318 pass; SDK unchanged.

## Product
Malformed project IDs400 rather than500; absent valid404/auth401 preserved.
ZIP test uses real exported archive to avoid invalid input masking lookup.
Existing saved translation preserved after invalid requests.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
Auth still first; malformed IDs rejected before database. Synthetic local data/
tokens only. No worker/license/spend/provider/token scope/registry change.

## QA/integration
Baseline four malformed requests500 failed400 checks. SDK193 (184prior+9),
formats269/review34/OTA117/browser26/providers2/132/URL81/redirect100/startup3/
strict relative-package types/package runtime2 pass. Includes absent404/auth401
per route and data preservation. Docs/diff pass. No new application-browser/
whole-web/Docker/external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps
unchanged. Five review passes complete before commit, no scoped issue remains.
