# SDK OTA project and version path components

## Developer
Both OTA helpers encode projectId; version helper also encodes version as one
path component. Completes component escaping within these two helpers only.
Normal numeric version/valid project paths unchanged. No SDK-wide audit claim.

## Product
Runtime query/fragment/path-like inputs previously selected an existing OTA
endpoint instead of using literal input. Now those requests reject and return
no bundle. TypeScript version remains number, runtime strings tested as misuse.

## Designer
SDK routing-only correction, no visible UI or screenshot claim.

## Security
Scope correctness, not an authorization bypass fix. URL encoding does not
validate UUIDs: encoded malformed project inputs currently get generic500 from
server instead of a clean4xx. This preexisting server validation gap is not
claimed fixed here. No token scope/worker/license/provider/spend/sharing changes.

## QA/integration
Real SDK/PostgreSQL/HTTP baseline exactly4 targeted failures. Fixed SDK46 checks
pass (42prior+4new), all malformed requests reject without returning bundles.
Initial post-fix assertions expected4xx; two malformed project inputs instead
returned generic500. Recorded this limit and narrowed assertions to rejection,
not a clean-client-error claim. Version misuse returns4xx. Actual OTA108 rerun
green; syntax/diff/docs pass. No build/unit/browser/native/provider rerun claim.
Latest804 API34/318 and OTA browsers85; whole-web797315/3864.22FULL/7PARTIAL/
1MISSING/defaultOFF/external gaps unchanged. Five reviews complete before commit.
