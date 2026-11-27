# SDK package declaration export

## Developer
Package exports now includes types condition before import/default runtime
entry. NodeNext package consumers can resolve .d.ts rather than implicit any.
New isolated symlink consumer compiles same narrowing fixture via package name
and imports ESM entry at runtime. No installation/dependency/registry changes.

## Product
Fixes prior type test blind spot: relative declaration import passed while
actual package import lost type safety. Runtime entry unchanged. Package stays
private/unpublished; no CommonJS support added or claimed.

## Designer
Package developer experience only, no UI/screenshot claim.

## Security
Consumer fixture uses no network or credentials, cleaned afterward. No provider/
worker/license/token scope/spend/sharing changes.

## QA/integration
Baseline NodeNext consumer4 errors: declaration hidden by exports plus three
unused negative annotations from implicit any. Fixed package2 checks strict
compile/runtime ESM green; relative strict types also pass. SDK73/OTA117/error44/
URL81/redirect100/startup3 green. Syntax/diff/docs pass. No build/unit/browser/
native/provider rerun claim. Latest827 API34/318/formats269,804 OTA browsers85,
whole-web797315/3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five perspectives complete before commit, no scoped findings remain.
