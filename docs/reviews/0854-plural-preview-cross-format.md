# Plural-only preview cross-format regression

## Developer
Extend786 shared comparison proof to ARB, Android XML and iOS stringsdict.
Each real parser imports original one/other forms, previews changed one with
same other value, then explicitly imports it and previews unchanged. No app
source change; restored after targeted mutation.

## Product
All three plural formats predict one actual write, not unchanged, when only
one form changes. Repeat preview reports unchanged. No new format/subset or
full preview-validation/concurrency guarantee claim.

## Designer
Backend tests only, no UI/layout/screenshot inspection claim.

## Security
Preview keeps exact key/form data and import-run count unchanged. All local
fixture content, no provider/worker/license/spending/sharing/auth/token-scope
change. No external attack claim.

## QA/integration
Real PostgreSQL/HTTP formats249 checks =234 existing+15 new pass. Reverting
only preview forms comparison yields8 expected failures:6 new across three
formats plus2 existing PO checks. Restored source rebuild and249 rerun green.
Build/syntax/diff/docs pass. No browser/whole-web/native/provider rerun claim.
Existing22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. All five
review perspectives complete before commit; no scoped findings remain.
