# 0097 - SAML cache capacity recovery and atomic operations

## Developer pass
The earlier wrapper inspected node-saml's private cacheKeys field and checked
capacity before calling its pruning code. Once full, expired entries could
prevent every new request/replay insertion forever. An awaited superclass
write also left the wrapper's capacity check separated from insertion.
Replace that wrapper with BoundedSamlCache, implementing the public
CacheProvider contract. Every mutation prunes/checks/writes without an await
between state changes. No dependency on private library field layout.

## Product pass
A temporary login surge must not require an API restart after requests
expire. Full caches still fail closed, but recover automatically on the next
insertion at expiry. This fixes local cache lifecycle, not distributed SSO.
SAML browser completion is still open; the read-only settings surface is not
an end-to-end browser sign-in implementation.

## Designer pass
API/cache-only change. No changed visual surface or new screenshot.

## Security pass
Request save throws on capacity; replay insert returns false on capacity,
which preserves the library's reject-on-unstorable-replay behavior. Existing
keys are not overwritten or extended. Replay retention uses the library's
explicit expiresAtMs, not an independently shortened request TTL. Consume
removes before return and rejects exact-expiry values. Invalid bounds throw.
No signature/crypto logic added, and no verifier policy weakened.
Still process-local: no distributed atomicity or restart-persistent replay
claims. O(number of live keys) pruning is bounded by configured capacity.

## QA/integration pass
Eight new API unit cases with fake clock/concurrent calls: full-request TTL
recovery without intervening read; 20 saves with capacity 2 admit exactly 2;
replay overflow/expiry recovery; 20 same replay inserts admit one; consume
single winner + exact-expiry rejection; no overwrite/TTL extension; remove
key/null contract; invalid bounds/expired timestamps. API units 143 PASS
(was 135), 19 suites (was 18), RC=0. Built API RC=0; SAML HTTP suite 51 PASS
unchanged, RC=0. No interim failed runs. Full sweep runs at final HEAD.
