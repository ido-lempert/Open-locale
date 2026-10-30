# 0094 - SAML status panel in settings UI

Slice 28. Read-only "Single sign-on (SAML)" panel on the project settings
page, fed by a new public GET /auth/saml/sp-info endpoint. The panel shows
instance-level server configuration; there is no instance-admin page, and
settings is where an admin looks for SSO wiring information.

## Pass 1 - Developer
- sp-info reads env ONLY: never constructs the SAML client, never contacts
  the IdP, so the endpoint is cheap and side-effect free. Unconfigured ->
  { configured: false } (not 404) so the UI renders a clean empty state.
- The e2e API boots with display-only SAML env values; no visual leg ever
  triggers the SAML client (no real cert parsing happens anywhere in the
  visual suite).
- The panel degrades: loading state, configured list, and unconfigured hint
  naming the exact env vars.

## Pass 2 - PM
- Closes the settings-UI follow-up for SAML as a READ-ONLY status surface.
  Editing SAML config from the UI is deliberately not offered: config is
  env-owned (secrets), and a write path would be a much larger security
  surface - out of this slice's authority.

## Pass 3 - Designer
- Panel mirrors the existing settings panels (locale-list rows, code chips
  for values, muted explainer copy). Verified rendered at 1366x900;
  OCR-inspected screenshot settings-saml-panel.png shows heading, explainer,
  configured status, entity ID, ACS URL, IdP entry point, metadata path and
  signing state. No literal brace issues in the Angular template.

## Pass 4 - Security
- Every returned field is already public: entity ID, ACS URL and IdP entry
  point appear in any login redirect URL and in the SP metadata document.
  The IdP certificate and SP private key are NEVER returned (a saml-test leg
  asserts their absence).
- The endpoint is unauthenticated by design (like metadata) and documented
  as such in the spec and the docs-consistency public allowlist.
- No new writes, no config mutation path, no secrets in UI state.

## Pass 5 - QA / integration
- saml suite: 42 checks (was 41), ALL PASS, RC=0 - new leg asserts sp-info
  configured state, public values, requestSigning flag, and absence of
  cert/key material.
- e2e-visual: 242 checks (was 238), ALL PASS, RC=0 - 4 new legs assert the
  panel content (status, entity ID + ACS, entry point + metadata path,
  signing state) plus a screenshot; screenshot OCR-verified.
- docs-consistency pass (route in openapi.ts + public allowlist). Unit api
  135/135, unit web 24/24 unchanged. Full sweep rerun at final HEAD.
- One interim build failure disclosed: the first web build failed TS2339
  (edit-script ordering bug dropped the component changes; reapplied) -
  tooling mistake, not an app defect; fixed before commit.
