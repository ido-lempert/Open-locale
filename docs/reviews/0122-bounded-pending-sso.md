# 0122 - Bounded pending SSO lifecycle

## Developer pass
Shared lifecycle implementation, separate OIDC/SAML stores. Synchronous capacity
check/insert and consume-before-verification, prune before capacity, exact TTL
boundary. Strict positive integer cap/finite positive TTL, default10000 per
protocol. Epoch retained. API restart still invalidates pending logins.

## Product pass
Resource hardening only. Full OIDC pending store now refuses with503; browser
SAML wraps failure in existing safe verifier handoff. No distributed-store,
provider acceptance, new UI or coverage promotion claim.

## Designer pass
No UI change. Existing safe-error and factor screens retained and exercised by
browser regressions. Overflow returns established error path, not a new surface.

## Security pass
Opaque192-bit one-use tokens, hard bound and expiry, no token logging. Protocol
stores remain isolated. Consumed entry cannot be retried after failed factor.
Pending epoch checks unchanged. OIDC authorization-state store is not made
bounded by this change; no blanket memory-bound claim.

## QA/integration pass
Seven new unit tests: identity/epoch/token shape/one-use, cap/preservation/reuse,
prune/exact expiry, concurrent capacity and consume, cross-protocol isolation,
invalid config. API205->212 tests. Real browser/HTTP OIDC38->42 checks overflow503
without token and recovery after failed consume; SAML57->61 tests safe handoff
error/no token and capacity recovery. Initial build caught leftover old Map
sweep and was fixed. Initial SAML fixture cap3 underestimated two retained
entries; cap4 leaves exactly two asserted admissions before tested overflow.

Final48 sweep legs individualRC0;43 integration/config legs in eight completed
fail-closed batch outerRC0. API212/25 suites, web24/5, builds/reaper4 RC0. Native
staged visual116+128 PASS=244 total/two repeated startups/242 unique, every source
assertion label covered; both stages inner/outerRC0, private checkpoint removed.
Staged, not uninterrupted. Focused final OIDC42/SAML61 browser checks RC0.
