# SDK native Chromium primitives

## Developer
Local HTTP server serves SDK ESM source. Chromium imports real module and uses
native Response/TextEncoder/TextDecoder/WebCrypto with synthetic fetchImpl.
Secure-context/subtle prerequisites asserted. No SDK runtime change. Server and
browser cleaned in finally. Request interception blocks unexpected destinations.

## Product
Eight browser cases cover Unicode, BOM included/added, malformed UTF-8, invalid
JSON/shape, wrong branch and304 selected validator. Not an application UI or
real browser-to-API/CORS test, nor Safari/Firefox/mobile compatibility proof.

## Designer
No UI changes; browser page is test plumbing. No screenshot or visual claim.

## Security
Synthetic data/fake tokens only; expected local URLs only. No user accounts,
external API requests or saved profiles. No worker/license/spend/registration/
provider scope/registry change.

## QA/integration
Native browser8 pass. Negative probe removed fatal decoding and failed exactly
malformed UTF8 case; restored runtime and reran green. Provider2/132, SDK73/
OTA117, URL81/redirect100/startup3, strict relative/package types and package
runtime2 pass. Syntax/docs/diff pass. No new application-browser/unit/formats/
build claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five
perspectives complete before commit with no scoped issue remaining.
