# Locale format export project UUID validation

## Developer
Eleven locale-format export routes use existing ParseUUIDPipe on projectId.
CSV/Android/stringsdict/iOS/PO/POT/XLIFF/RESX/properties/ARB/YAML covered.
JSON previously fixed. ZIP/TMX and other routes unchanged. SDK runtime unchanged.
Uncached API build and API34/318 pass.

## Product
Malformed project IDs400 rather than500 consistently across these formats.
Valid absent project404 and unauthenticated malformed401 preserved. Existing
formats269 proves valid import/export behavior remains green.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
Reject malformed IDs before database lookup, auth remains before validation.
Local synthetic data/tokens only. No worker/license/spend/provider/token scope/
registry change.

## QA/integration
Baseline22 malformed requests returned500 and failed intended400 assertions.
SDK154 (110prior+44) covers two malformed, absent404 and auth401 per format.
Formats269/OTA117/browser26/providers2/132/URL81/redirect100/startup3/strict
relative-package types and package runtime2 pass. Docs/diff pass. No new
application-browser/whole-web/Docker/external claim.22FULL/7PARTIAL/1MISSING/
defaultOFF/external gaps unchanged. Five reviews complete before commit,
no scoped issue remaining.
