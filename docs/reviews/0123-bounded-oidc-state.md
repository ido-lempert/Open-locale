# 0123 - Bounded OIDC authorization state

## Developer pass
Dedicated process-local store, default10000 entries/ten-minute TTL. Strict
positive integer cap and finite positive TTL. Snapshot nonce/verifier/link user/
epoch, prune before cap, exact expiry, synchronous create/consume. Capacity
checked after awaited discovery with no await before insertion, so concurrency
cannot exceed cap. Consumption remains before code exchange/validation.

## Product pass
Resource hardening only. Full store503 returns no authorization URL; consuming
an entry even on bad exchange frees capacity. API restart remains fail-closed.
No distributed store, provider acceptance, new UI or coverage promotion.

## Designer pass
No UI change; existing callback/start error behavior retained. Real browser
regressions cover existing surfaces, no new screenshot required for store code.

## Security pass
Opaque192-bit state, snapshot of PKCE/nonce/account/epoch stays server-side.
No extra credential exposure. Expiry cannot be silently disabled by NaN or
zero configuration. One-use even on exchange rejection. No changes to token
signature/issuer/audience verification or provider registration.

## QA/integration pass
Five new unit tests for snapshots/shape/one-use, overflow preservation/recovery,
exact expiry/prune, concurrent cap/consume, invalid configuration. API212->217 in
26 suites. OIDC browser42->49 adds three explicit admissions,503/no URL,
failed-exchange consumption,recovery,replay via real HTTP/mock issuer. All initial
checks pass. Existing protocol/link/epoch tests retained.

Final48 sweep legs individualRC0;43 integration/config legs in eight completed
fail-closed batches outerRC0. API217/26 suites, web24/5, builds/reaper4 RC0.
Native visual stages116+128 PASS=244 total/two repeated startups/242 unique;
every source assertion label covered, both stages inner/outerRC0. Checkpoint
removed. Staged, not uninterrupted. No failures/interrupted checks this slice.
