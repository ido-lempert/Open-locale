# Screenshot path UUID validation

## Developer
Screenshot upload/list/download/delete apply existing ParseUUIDPipe to project/
key IDs; download/delete also screenshotId. All UUID path identifiers in key
controller now validated. Body/query IDs not included. Uncached API build and
API34/318 pass, SDK unchanged.

## Product
Malformed IDs400 instead of500. Absent valid project/key/screenshot404/auth401
retained. Original metadata and exact binary preserved. Valid PNG upload used
for malformed upload probes, avoiding unrelated file rejection.

## Designer
API-only validation; binary test fixture is not a visual deliverable. No UI,
screenshot capture or visual acceptance claim.

## Security
Auth first. File interceptor still parses bounded multipart before pipes, so
not a claim that malformed route avoids upload parsing. Service/database rejects
before lookup. Local synthetic tokens/images only. No worker/license/spend/
provider/token scope/registry change.

## QA/integration
Baseline12 malformed paths500 failed400 checks. Screenshot45 (18prior+27),
SDK234, OTA117/browser26/providers2/132/URL81/redirect100/startup3/relative-package
strict types/package runtime2 pass. Includes absent404/auth401 and metadata/byte
preservation. Docs/diff pass. No fresh application-browser/whole-web/Docker/
external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five review passes complete before commit, no scoped issue remains.
