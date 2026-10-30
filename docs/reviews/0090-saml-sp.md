# 0090 - SAML service provider (inbound Web-SSO, POST binding)

Slice 24. Adds a SAML 2.0 SP to the API: `GET /auth/saml/login` (SP-initiated
login URL), `POST /auth/saml/acs` (assertion consumer), `POST /auth/saml/complete`
(second-factor completion). All XML signature and condition validation is
delegated to the maintained `@node-saml/node-saml` v5 library (xml-crypto
underneath); nothing in the codebase parses or verifies signatures by hand.

## Deliberately out of this slice (follow-ups)
- SAML account linking for existing users (today: fail-closed 409, no auto-link).
- SP metadata endpoint (`/auth/saml/metadata`).
- Signed AuthnRequests (SP request signing).
- Unifying the SAML/OIDC pending-2FA stores and the duplicated finish flow.
- SAML configuration in the settings UI.

## Pass 1 - Developer
- SAML client instance is cached on the service: the library's default
  in-memory cache provider holds the issued AuthnRequest IDs, so the instance
  MUST be shared between login and ACS for InResponseTo enforcement to work.
- Identity-binding race handled (unique issuer+subject; loser follows the
  winner's binding).
- FOUND+FIXED: two concurrent first logins for the same new email could both
  pass the existence check, and the unique-constraint loser surfaced a 500.
  Now fails closed with the same 409 as a normal collision - never auto-links.
- Pending-2FA store duplicates the OIDC shape deliberately; unification is a
  documented follow-up so the verified OIDC path is untouched this slice.

## Pass 2 - PM
- Scope matches the authorized slice exactly; follow-ups named above.
- 409 copy tells the user what happened and why ("account linking is not yet
  implemented") instead of a bare error.
- Unconfigured SAML (no SAML_ENTRY_POINT/SAML_IDP_CERT) returns 404 so the
  endpoints are invisible until an admin wires an IdP.

## Pass 3 - Designer
- API-only slice; no UI surface. Settings-UI configuration is the follow-up
  that will need design attention (cert paste, attribute mapping, test-login).

## Pass 4 - Security
Fail-closed posture (each has a discriminating transport-level test leg):
- Signatures: both Response and Assertion must be RS256-signed with the
  configured IdP cert (`wantAuthnResponseSigned` + `wantAssertionsSigned`);
  unsigned-assertion and unsigned-response legs both 401. Tampered-after-
  signing leg 401. The cert comes only from server env - KeyInfo inside the
  assertion is never trusted as a key source.
- Wrapping/duplication: integration precheck requires exactly one Response
  and exactly one Assertion; the library additionally rejects unexpected
  assertion counts (plain+encrypted).
- Issuer: pinned to SAML_IDP_ENTITY_ID. Audience: pinned to the SP entity ID
  (wrong-audience leg 401).
- Recipient/Destination: library v5 only WARNS on these (rejection announced
  for v6), so the integration hard-fails them itself on the raw XML:
  Response/@Destination and every SubjectConfirmationData/@Recipient must
  equal the ACS URL (wrong-recipient and wrong-destination legs 401).
  The precheck parser is @xmldom/xmldom, which does not resolve external
  entities (no XXE surface), and it performs no signature logic.
- Time: Conditions/SubjectConfirmationData NotOnOrAfter enforced
  (expired-conditions leg 401) plus maxAssertionAgeMs.
- Replay/InResponseTo: `validateInResponseTo: always` (missing and unknown
  InResponseTo legs 401), request IDs are consumed once and assertion-ID
  replay is rejected (byte-identical replay leg 401).
- No homegrown crypto anywhere: signing (mock) and verification (app) both
  use the maintained xml-crypto via node-saml.
- Account takeover: no auto-link by email (409 leg + no-binding leg). Local
  2FA still applies after SSO (requiresTwoFactor + wrong/right-code legs);
  pending tokens are single-use.
- The 401 body includes a short (<=160 chars) library reason for operability;
  it carries no user data and does not distinguish which accounts exist.

## Pass 5 - QA / integration
- `node scripts/saml-test.mjs`: 22 checks, all PASS, RC=0 (boots embedded
  Postgres, the openssl-generated mock IdP and the real built API; all legs
  are HTTP-transport-level).
- Negative legs are discriminating: each mints an otherwise fully valid,
  correctly signed response with a fresh SP-issued InResponseTo, so only the
  rule under test can reject it.
- Suite wired: `test:saml` script + `saml` leg in scripts/sweep.sh (sweep is
  now 40 legs). Unit api 135/135 unchanged (RC=0) after AuthModule wiring.
- Two interim FAIL runs disclosed: (1) test-fixture bug - the 2FA completion
  leg reused the TOTP window claimed by 2FA enable (correct replay rejection
  by the app; test now uses the next window, matching the OIDC suite's
  pattern); (2) test-fixture bug - the happy-path leg expected a refreshToken
  field this JWT-only app never issues; fixed and strengthened to verify the
  SSO-issued session against a protected endpoint.
