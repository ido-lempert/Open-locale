# 0098 - SAML issuer, namespace and signing configuration

## Developer pass
Require SAML_IDP_ENTITY_ID when SAML is enabled. Previously config omitted it
when unset, silently disabling the library's issuer equality check. Require
SP signing key/cert together; before client construction verify parseable RSA
private key and certificate with the same public SPKI bytes. This uses Node's
standard key parsing, not custom signing or XML signature verification.
The cached client validates once; env changes require API restart as before.

## Product pass
Document the required issuer and signing pair in README. The settings status
is a display surface, not a cryptographic health check. Missing issuer or a
partial pair fails closed rather than suggesting a usable SAML setup. SAML
browser completion remains open; no external-IdP acceptance claim.

## Designer pass
API/config-only. No visual surface changed. Existing status panel unchanged;
future diagnostics should distinguish configured values from validated setup.

## Security pass
Require protocol namespace on the Response and assertion namespace on the
Assertion and the assertion-vocabulary elements used by the verifier's
local-name selectors. A sole wrong-namespace Response, Assertion or Subject
is rejected rather than accepted merely because its local name matches.
Signed wrong-issuer responses still pass signature construction in the mock
but fail the pinned-issuer check with an explicit issuer reason. Namespace
fixtures are changed before signing, and exact structural reasons are
asserted. Existing response/assertion signature requirements remain intact.
This is bounded hardening, not schema validation or a blanket verifier audit.

## QA/integration pass
SAML HTTP suite 51 -> 55 PASS, RC=0: four added cases for signed wrong issuer,
wrong Response namespace, wrong Assertion namespace and wrong Subject
namespace. API units 143 -> 150 PASS, suites 19 -> 20, RC=0: seven config cases
(missing/blank issuer, each half-pair, invalid pair, valid key/invalid cert,
valid key with different valid certificate). Matching valid key/cert remains
covered by the HTTP suite's real signed AuthnRequests.

Interim failure disclosed: first new config unit suite could not load because
importing AuthService pulled ESM @nestjs/jwt into Jest's CJS runtime. Isolated
that unrelated injected dependency with a test-only AuthService stub; actual
SamlService and node-saml stay real. Subsequent units passed (149, then 150
as the valid-but-mismatched certificate case was added). No product fix was
made to satisfy the test harness. API build RC=0. Full sweep at final HEAD.
