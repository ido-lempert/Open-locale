# SDK native browser HTTP fixture

## Developer
Existing Chromium test now also uses default fetch against local fixture server.
Fresh bundle, conditional304 and changed response bytes tested. Exact three
request paths/methods/fake-token/conditional headers asserted server-side.
Cache-Control no-store ensures network evidence, not cached synthetic results.
SDK runtime unchanged. Unexpected destinations blocked, cleanup in finally.

## Product
Closes same-origin native browser transport evidence gap. Does not test built
API, database, cross-origin CORS, non-Chromium or mobile browsers.

## Designer
No UI change or visual claim. Browser page is contract plumbing.

## Security
Only local requests with fake token and synthetic text. Digest mismatch proves
changed bytes rejected. No accounts, external requests, worker/license/spend/
provider registration/token scope/registry change.

## QA/integration
Browser11 (8prior+3transport) pass. Removing conditional header failed native
HTTP304 check, restored runtime and reran green. Provider2/132, SDK73/OTA117,
URL81/redirect100/startup3, relative/package strict types and package runtime2
pass. Syntax/docs/diff pass. No new application-browser/unit/formats/build
claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five reviews
complete before commit with no scoped issue remaining.
