# 0091 - SAML SP hardening: precheck binding, DTD rejection, store bounds

Slice 25. Follow-up to 0090 addressing review points: prove the structural
precheck and the library's signature-verified nodes bind to the SAME
Response/Assertion under wrapping/namespace-confusion/duplicate-ID attacks,
reject DOCTYPE/entities, and make request-cache / pending-store lifecycle and
bounds explicit.

## Binding argument (precheck-on-raw == verified nodes)
The precheck inspects the RAW XML; the library processes VERIFIED bytes. They
cannot diverge in this configuration, by construction:
- The library selects assertions with `/*[local-name()='Response']/*[local-name()='Assertion']`
  on the raw doc (node-saml saml.js:900) - the exact xpath the precheck uses.
  The precheck requires the count to be exactly one, so the library's
  `assertions[0]` is the only candidate assertion in the document.
- `wantAssertionsSigned: true` forces `getVerifiedXml` over that very element
  (saml.js:907-912); unsigned or unverifiable -> throw. The assertion that is
  later processed comes from `getSignedAssertion(verifiedXml)`, i.e. from the
  signature-covered bytes, not from the raw tree (saml.js:938-946).
- `wantAuthnResponseSigned: true` forces a valid Response-level signature;
  verified Destination/InResponseTo are read from the verified Response
  (saml.js:877-899). The raw-vs-verified values cannot differ because the
  Response signature covers the raw bytes that were checked.
- Recipient/Destination hard-fail therefore applies to the same signed nodes
  the library verified: the precheck's raw values are the signed values.
Residual ambiguity removed rather than argued:
- Duplicate-ID guard: any repeated ID/Id/id attribute anywhere in the
  document is rejected, so reference resolution can never bind to a different
  element than the precheck examined.
- Namespace confusion: a `local-name()='Assertion'` sibling in ANY namespace
  counts toward the exactly-one rule (both precheck and library count it),
  so a namespaced extra assertion is rejected, not ignored.

## Pass 1 - Developer
- BoundedCacheProvider wraps InMemoryCacheProvider: the library default prunes
  by TTL (8h) but has NO size cap; /auth/saml/login is unauthenticated, so the
  request-ID/replay store was an unbounded memory-growth vector. Now: hard cap
  (default 10k, SAML_CACHE_MAX), key TTL = request TTL (10 min,
  requestIdExpirationPeriodMs made explicit).
- Pending-2FA store: sweep-expired-on-insert + hard cap (default 10k,
  SAML_PENDING_MAX) failing closed with 503; TTL constant named.
- Adversarial injections in the mock happen BEFORE Response signing so the
  signature stays valid and each leg isolates one structural rule.

## Pass 2 - PM
- No scope change: same endpoints, same flows; this is hardening of the slice
  just landed. Follow-up list from 0090 unchanged.
- Failure copy stays honest: structural rejections say exactly what was
  rejected ("Duplicate XML ID", "Expected exactly one SAML assertion").

## Pass 3 - Designer
- No UI surface.

## Pass 4 - Security
- DTD: raw XML containing `<!DOCTYPE` or `<!ENTITY` (any case) is rejected
  before parsing - xmldom expands internal entities (billion-laughs class),
  and no SAML POST response needs a DOCTYPE.
- Duplicate XML ID anywhere in the document -> 401 (wrapping primitive
  removed at the root).
- Four discriminating adversarial legs, all 401 with the rule's OWN reason
  asserted in the check (not an incidental signature failure):
  DOCTYPE/entity, sibling second assertion, hidden duplicate-ID assertion in
  Extensions, namespace-confused assertion sibling.
- Resource bounds: request-ID cache, replay store and pending-2FA store are
  all TTL-bounded AND size-capped; overflow fails closed (login refused /
  replay treated as seen).
- No homegrown crypto added; the mock still signs with maintained xml-crypto.

## Pass 5 - QA / integration
- `node scripts/saml-test.mjs`: 26 checks (was 22), ALL PASS, RC=0.
- Adversarial leg checks assert the rejection REASON, proving discrimination.
- Unit api 135/135 unchanged. Full 40-leg sweep rerun at the final HEAD of
  this slice (code changes, not wording).
