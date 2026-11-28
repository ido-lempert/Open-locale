# SDK OTA exact byte integrity

## Developer
Hash Uint8Array from Response.arrayBuffer instead of re-encoding Response.text.
HTTP errors retain precedence and UTF-8 decode behavior. Successful responses
are decoded only after digest validation. Both crypto backends consume bytes.

## Product
BOM added after a digest no longer disappears before checking. A BOM included
in the digest remains accepted. Server publication format is unchanged.

## Designer
SDK-only behavior, no UI or screenshot claim.

## Security
Baseline accepted BOM-prefixed bytes with the digest of BOM-free JSON. Fixed
comparison uses actual received bytes. Synthetic bodies only, no observed
external incident. Digest is not an authenticity signature. TLS/token needed.
No worker/license/provider/token-scope/spend/registry change.

## QA/integration
Error50 includes three new exact-byte cases: BOM addition rejected, correctly
hashed BOM accepted, malformed UTF-8 with digest of decoded bytes rejected.
Baseline first case failed the intended rejection assertion. SDK73/OTA117,
URL81/redirect100/startup3, strict relative/package types and package runtime2
pass, rerun after decode ordering adjustment. Syntax/docs/diff pass. No fresh
browser/unit/formats/build claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external
gaps unchanged. Five perspectives complete before commit; no scoped issue.
