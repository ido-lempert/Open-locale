# Key update/tags/delete UUID validation

## Developer
Three key write routes validate project/key UUID using existing ParseUUIDPipe.
Only update/setTags/remove changed, not comments/screenshots. Uncached API build
and API34/318 pass. SDK runtime unchanged.

## Product
Malformed IDs400 rather than500, valid absent project/key404/auth401 retained.
Original key/description/tags preserved after invalid writes. Tags workflow9
passes. Not whole API UUID coverage.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
Auth first, malformed identifiers rejected before database. Synthetic local
keys/tokens only. No worker/license/spend/provider/token scope/registry change.

## QA/integration
Baseline12 malformed plain/punctuation project/key requests500 failed400 checks.
SDK215 (193prior+22), tags9, OTA117/browser26/providers2/132/URL81/redirect100/
startup3/relative-package strict types/package runtime2 pass. New cases include
absent project/key404/auth401 per route and original key preservation. Docs/diff
pass. No fresh formats/application-browser/whole-web/Docker/external claim.
22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five perspectives
complete before commit, no scoped issue remaining.
