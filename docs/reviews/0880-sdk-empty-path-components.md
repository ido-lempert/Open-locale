# SDK empty named-helper path component guard

## Developer
Shared pathComponent now rejects empty string as well as dot segments before
fetch. This avoids empty segment collapsing/collection route selection. No
truthiness coercion: normal numeric version0 still becomes string0 and reaches
server, unchanged. Explicit generic request(path) remains caller-controlled.

## Product
projects.get with empty identifier cannot silently return project collection.
Every named-helper component slot gets same invalid empty-value contract.
Local OpenLocaleError status0 thrown synchronously, as dot guard already does.

## Designer
SDK validation only, no UI or screenshot claim.

## Security
No trim or normalization to another identifier; empty input rejects outright.
No server auth/identifier validation or full Unicode audit claim. No provider/
worker/license/token scope/spend/sharing/registry changes.

## QA/integration
Baseline URL suite fails first empty-component missing-rejection assertion.
Fixed URL74 checks (58prior+16new), real SDK67 (66prior+1new), occupied-port
harness3 and OTA117 pass. Syntax/diff/docs pass. No build/unit/browser/native/
provider rerun claim. Latest807 API34/318,804 OTA browsers85, whole-web797315/3864.
22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five perspectives
complete before commit; scoped findings fixed and rerun.
