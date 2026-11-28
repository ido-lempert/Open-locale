# Snapshot path UUID validation

## Developer
All snapshot-controller project/snapshot path IDs use existing ParseUUIDPipe.
Uncached API build/API34/318 pass. Snapshot service/SDK unchanged.

## Product
Malformed IDs400 instead of500, absent valid404/auth401 preserved. Snapshot
list and saved translation unchanged after invalid calls. Snapshot workflow61
passes. No change to restoration authority.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
Auth remains first. Owner session probes, synthetic local data only. No worker/
license/spend/provider/token scope/registry change.

## QA/integration
Baseline4 malformed500 failed intended400 checks. SDK344 (332prior+12) includes
per-slot absent404, per-route auth401 and list/translation preservation.
Snapshots61/OTA117/browser26/providers2/132/URL81/redirect100/startup3/strict
relative-package types/package runtime2 pass. Docs/diff pass. No fresh
application-browser/whole-web/Docker/external claim.22FULL/7PARTIAL/1MISSING/
defaultOFF/external gaps unchanged. Five reviews complete before commit,
no scoped issue remaining.
