# SDK isolated digest provider contracts

## Developer
New npm test:sdk-crypto launches isolated Node children for WebCrypto and absent
global crypto (node:crypto fallback). Global accessor verifies SDK inspection;
WebCrypto wrapper verifies actual digest use. Each child runs the full existing
66-check error contract. Parent checks exit status/signal, all PASS rows, exact
summary and provider sentinel. Timeout bounds child hangs. SDK runtime unchanged.

## Product
Both implementations now prove byte/BOM, invalid UTF-8, shape, scope and HTTP
error behavior. This is Node isolation evidence, not browser compatibility proof.

## Designer
Test-only work, no UI or visual acceptance claim.

## Security
Synthetic bodies/fake tokens only. Children never reach an API. No credentials
or global provider overrides persist outside child. No worker/license/spend/
provider registration/token scope/registry change.

## QA/integration
2 providers /132 checks green. Wrong expected count probe failed66-vs67, then
restored. Mutating fallback digest to empty bytes failed intended integrity/
parse precedence assertion, then runtime restored and all tests rerun green.
SDK73/OTA117, URL81/redirect100/startup3, strict relative/package types and
package runtime2 pass. Syntax/docs/diff pass. No fresh browser/unit/formats/build
claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five passes
complete before commit; no scoped issue remains.
