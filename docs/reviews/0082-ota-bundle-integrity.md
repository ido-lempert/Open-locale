# Review 0082 - OTA bundle integrity digest (slice 18)

## Why
Audit of the OTA PARTIAL against the plan bullet ("versioned CDN endpoint and
mobile SDK"): versioning, immutability, ETag/304 and branch scoping already
existed and were tested. The real gap for a mobile SDK was payload INTEGRITY:
the only content hash in play was the ETag's 48-bit discriminator - enough to
tell versions apart, not to verify a downloaded bundle byte-for-byte.

## What changed
- GET bundle responses (200 AND 304) now carry X-OpenLocale-Bundle-SHA256: the
  full sha256 of the exact served bytes (the object is hashed via the same
  JSON.stringify the framework uses to serialize it, so the digest covers the
  response body byte-for-byte). The 304 carries it too: a client holding the
  body can re-verify integrity without re-downloading.
- No new routes; no auth changes (bundle pulls keep their existing
  session/read-token rules).

## Verification (this HEAD)
- ota suite: 36 PASS / 0 FAIL / RC=0 (was 32; +4: header present and 64-hex,
  digest equals a client-side recomputation over the raw response bytes, 304
  carries the same digest, v1 digest stable and different from v2).
- api build RC=0.

## Boundaries kept
- This is payload integrity for the existing self-hosted endpoint, NOT a CDN:
  the "versioned CDN endpoint" part of the plan bullet needs real CDN
  infrastructure (production acceptance, user-owned). The OTA coverage item
  stays PARTIAL. Cache policy unchanged (private, no-cache) because pulls are
  authenticated; fronting a shared cache would need an authorization design,
  not a header tweak.
