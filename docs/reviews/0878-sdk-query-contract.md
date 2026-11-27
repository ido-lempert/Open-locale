# SDK query option contract

## Developer
Fast URL suite now checks exact query key/value sequence for nine helper option
combinations. Branch/search/OTA locale/publicationId stay single values, empty
pin retained, dryRun true preserved. Non-OTA cases now require successful mock
result instead of accepting any OTA integrity-style exception. No SDK edit.

## Product
Query options cannot silently become branch/dryRun/fragment control syntax.
Explicit empty publication pin retains server rejection semantics. Fast tests
complement real HTTP behavior, not a substitute for response validation.

## Designer
No UI change or screenshot claim.

## Security
Mock-only URL contract with fixed fake token and invalid network domain. Exact
query entries detect duplicate/injected options and hashes. No provider/worker/
license/token-scope/spend/sharing/registry changes.

## QA/integration
Fast58 checks (49prior+9new) pass. Mutation replaced query serialization with
raw concatenation: first new literal query assertion fails. SDK restored,
58 rerun green. Real SDK66/OTA117 pass. JS syntax/diff/docs pass. No build/unit/
browser/native/provider rerun claim. Latest807 API34/318,804 OTA browsers85,
whole-web797315/3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five review perspectives complete before commit, no scoped issues remain.
