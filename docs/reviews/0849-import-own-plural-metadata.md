# Import plural metadata uses only explicit own entries

## Developer
Shared import loop used optional indexed access on a normal plural map.
Missing __proto__/constructor/toString/hasOwnProperty metadata resolved
inherited values and failed valid plain entry transactions. Gate lookup with
hasOwnProperty.call; explicit owned special-name plurals still apply normally.
No parser/schema or partial-import contract change.

## Product
Mixed ARB plain special-name entries and ordinary plural now all import,
instead of PARTIAL with4 failed plain values. Plain metadata stays nonplural;
explicit subsequent __proto__ plural upgrades correctly with exact forms.

## Designer
Backend import correction only, no UI/screenshot inspection claim.

## Security
Only importer-provided own forms can select plural validation/write branch.
No external attack or global pollution claim. No auth, provider, worker,
license, spending, sharing or credential-scope change. Fixed local fixtures.

## QA/integration
Actual PostgreSQL/HTTP baseline2 targeted failures: PARTIAL1upsert/4failed
and missing exported values. Fixed complete formats suite222 checks, with4
new checks for full import, exact export, nonplural metadata and explicit
special-name plural upgrade. API build, syntax/diff/docs pass. No browser,
whole-web/native/provider rerun claim. Existing22FULL/7PARTIAL/1MISSING/
defaultOFF/external gaps unchanged. Diagnostic removed. All five reviews
complete before commit; no scoped findings remain.
