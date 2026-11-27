# SDK OTA TypeScript result narrowing

## Developer
OtaPull now discriminated union on notModified. Fresh branch requires typed
OtaBundle and verified digest string;304 branch permits no bundle. Exported
OtaBundle names existing minimum shape. Compile-only fixture proves narrowing
and rejects impossible combinations. No runtime change.

## Product
TypeScript callers can read bundle after checking fresh result without extra
undefined assertion. Consumers constructing invalid OtaPull objects or extending
old interface must update; type alias replaces interface deliberately. Private
package0.1.0 remains unpublished.

## Designer
Developer types only, no UI/screenshot claim.

## Security
Types reflect existing validation, not new runtime security.304 digest remains
nullable and cached-byte verification remains caller responsibility. No token/
provider/worker/license/spend/sharing changes.

## QA/integration
Baseline compile4 errors: two unsafe narrowed reads, two unused expected-error
annotations for invalid combinations. New discriminated type strict compile
passes with negative annotations consumed. Real SDK73/OTA117, error44/URL81/
redirect100/startup3 pass. Docs/diff pass. No build/unit/browser/native/provider
rerun claim. Latest827 API34/318/formats269,804 OTA browsers85, whole-web797315/
3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five reviews
complete before commit, no scoped findings remain.
