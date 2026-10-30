# Review 0087 - SDK OTA pulls with integrity verification (slice 22)

## Why
The OTA plan bullet names a "mobile SDK". The server side gained a full
sha256 bundle digest in slice 18 - but a digest no consumer verifies is
decoration. The SDK (the bundle's actual consumer) had no OTA surface at
all. This slice closes the loop: the SDK pulls bundles and verifies them.

## What changed (libs/sdk only, zero new dependencies)
- ol.ota.latest(projectId, locale, { branch, etag }) and
  ol.ota.version(projectId, version, locale, { branch, etag }) resolve to
  { notModified, etag, sha256, bundle }.
- Verification is fail-closed: the X-OpenLocale-Bundle-SHA256 header must be
  present (64-hex) and match a client-side sha256 over the exact received
  bytes, or the promise rejects with OpenLocaleError. A tampered or
  corrupted bundle is never returned as data.
- etag from a previous pull sends If-None-Match; a 304 resolves to
  { notModified: true, sha256 } so callers re-verify their cached copy
  without re-downloading (the 304 carries the digest by slice-18 design).
- Hashing uses WebCrypto (node >=20 and browsers), node:crypto as fallback;
  the zero-dependency constraint holds.
- Publish stays session-only server-side and is deliberately not exposed in
  the SDK; pulls work with a read-scope API token (the SDK's auth model).
- index.d.ts and README SDK section updated.

## Verification (this HEAD)
- sdk suite: pass=16 fail=0 RC=0 (was 11; +5: verified latest pull with
  64-hex digest and ETag; If-None-Match 304 yields notModified carrying the
  same digest; byte-tampered bundle rejected via fetchImpl injection and
  never returned; missing digest header fails closed; version(1) pull after
  v2 publish is immutable with a digest distinct from v2's).
- The tamper leg mutates the actual response bytes in flight, so the
  byte-exactness of TextEncoder re-encoding against the server digest is
  proven, not assumed.

## Boundaries
- OTA stays PARTIAL: this is SDK-side consumption of the self-hosted
  endpoint; the versioned CDN endpoint and production acceptance are
  user-owned. No coverage change.
