# Native browser SDK POST redirect rejection

## Developer
Local redirect fixture now captures body after request end. Exact15 requests
assert method/body as well as paths/fake-token headers. Adds POST for each of
301/302/303/307/308. Original request/OTA GET cases retained. SDK unchanged.

## Product
Browser26 adds5 POST checks. Rejecting redirects avoids method rewriting on
301/302/303 and body forwarding on307/308. Final API URL required. Same-origin
fixture only, no cross-origin/CORS or built-application proof.

## Designer
Test-only change. No UI/screenshot/visual claim.

## Security
Only fake-token/local synthetic Unicode payload. Destination is allowed by
interceptor but receives zero requests. Negative probe enables follow only for
POST; fails301 POST as intended, then restored. No external incident. No worker/
license/spend/provider/token scope/registry change.

## QA/integration
Browser26, providers2/132, SDK73/OTA117, URL81/Node redirect100/startup3,
relative/package strict types and package runtime2 pass. Syntax/docs/diff pass.
No new application-browser/unit/formats/build claim.22FULL/7PARTIAL/1MISSING/
defaultOFF/external gaps unchanged. Five perspectives complete before commit,
no scoped issues remain.
