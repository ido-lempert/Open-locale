# OTA duplicate scalar query fail-closed regression

## Developer
Investigated duplicate branch/locale/publicationId on latest and retained
version routes. Existing behavior is404, not internal error. No implementation
fix or new400 contract needed. Added5 real HTTP checks with valid If-None-Match
so duplicates cannot select a bundle or return false304. App source unchanged.

## Product
Ambiguous duplicate scope never silently picks first value. Existing valid
scalar reads/conditional304 remain usable through subsequent suite checks.
No query syntax expansion or broader acceptance claim.

## Designer
Backend test only, no UI/layout/screenshot inspection claim.

## Security
Existing auth and immutable scope/pin checks remain intact. No provider,
worker/license/spending/sharing/credential-scope change. No incident claim.

## QA/integration
Actual PostgreSQL/HTTP OTA81 checks =76 prior+5 new pass. Initial hypothesis
expected400; observed404 corrected before final assertions. Array-first
mutation had no effect because received duplicate scalars are comma-joined;
comma-first mutation produces exactly5 targeted false304 failures. Restored
controller rebuilt and81 rerun green. Build/syntax/diff/docs pass. No browser,
whole-web/native/provider rerun claim. Existing22FULL/7PARTIAL/1MISSING/
defaultOFF/external gaps unchanged. Five reviews complete before commit.
