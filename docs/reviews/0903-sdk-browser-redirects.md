# Native browser SDK redirect rejection

## Developer
Extend local Chromium fixture with301/302/303/307/308 redirects for generic
request and OTA GET. Exact ten source paths/fake token headers asserted.
Destination allowed by request interceptor so SDK redirect regression cannot
hide behind blocking. Assert zero destination requests. Explicit local URL
allowlist replaces expression matching for easier audit. SDK runtime unchanged.

## Product
Browser21 includes10 redirect cases. Same-origin redirects rejected too, so
callers must supply final API URL. Does not prove cross-origin/CORS or POST
browser redirects; existing Node100 matrix remains separate evidence.

## Designer
Test-only work, no UI/screenshot/visual claim.

## Security
Fake token/local fixture only. Zero destination requests in green run. Separate
mutations enabling follow on request/OTA failed their intended301 checks, then
restored. No observed external incident. No worker/license/spend/provider/
token scope/registry change.

## QA/integration
Browser21, providers2/132, SDK73/OTA117, URL81/redirect100/startup3, strict
relative/package types and package runtime2 pass. Syntax/docs/diff pass.
No new application-browser/unit/formats/build claim.22FULL/7PARTIAL/1MISSING/
defaultOFF/external gaps unchanged. Five review passes complete before commit,
no scoped issue remaining.
