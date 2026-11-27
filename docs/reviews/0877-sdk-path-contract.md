# SDK named-helper URL contract

## Developer
Added fast isolated fetch-spy test for all16 named-helper path component slots.
Checks exact URL pathname after URL parsing, no fragment/injected branch and
expected token header. Both dot forms reject before fetch in every slot.
Explicit generic request path remains caller-controlled. No SDK implementation
change. npm test:sdk-path is separate from actual database/HTTP SDK suite.

## Product
Maintains coverage for future helper edits without requiring database startup.
Exact URL contract complements, does not replace, real branch/write regression
checks. No new product capability or registry publish.

## Designer
No visible UI or screenshot claim.

## Security
Scope is URL construction only, no authentication/HTTP response verification
claim from spy. OTA mock response intentionally lacks digest and its expected
error is captured only after checking actual outgoing request. No provider/
worker/license/spend/sharing/token scope changes.

## QA/integration
Fast contract49 checks =16 encoding+32 dot+1 explicit request. Mutation removing
encoding fails first exact-path assertion; restored SDK and reran49 green.
Actual SDK66/OTA117 pass with child reaping. Syntax/diff/docs pass. No build/
unit/browser/native/provider rerun claim. Latest807 API34/318,804 OTA browsers85,
whole-web797315/3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five perspectives complete before commit, no scoped issues remain.
