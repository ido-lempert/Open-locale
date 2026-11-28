# SDK OTA strict UTF-8

## Developer
Decode successful OTA bytes with fatal UTF-8 after exact-byte digest checks.
Decode failures become scoped OpenLocaleError, not native exceptions. HTTP
error decoding stays permissive and takes precedence, as before. JSON parsing
and required-field validation follow decoding. BOM behavior unchanged.

## Product
Correctly hashed malformed UTF-8 previously returned replacement characters
inside translations. Reject instead of silently changing the translation.
Legitimate replacement characters, NUL, Hebrew/emoji and max Unicode survive.

## Designer
SDK only. Fixed encoding error message includes no bundle contents. No visual
change or screenshot claim.

## Security
Synthetic malformed byte sequences only, no observed outside incident. Digest
mismatch still wins over encoding errors. Digest remains no authenticity proof.
No worker/license/provider/token scope/spend/registry change.

## QA/integration
Baseline first malformed case failed intended rejection. Six encoding classes
(isolated continuation, invalid lead, overlong, truncated, surrogate, above
Unicode maximum) each tested with correct/mismatched digest. Four valid Unicode
cases preserved. Error66 (50prior+16), SDK73/OTA117, URL81/redirect100/startup3,
strict relative/package types and package runtime2 pass. Syntax/docs/diff pass.
No fresh browser/unit/formats/build claim.22FULL/7PARTIAL/1MISSING/defaultOFF/
external gaps unchanged. Five review passes complete before commit, no scoped
issue remains.
