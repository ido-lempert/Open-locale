# Own glossary translation input values

## Developer
Input projection uses own-entry lookup rather than inherited indexing. Missing
values stay empty; own values and nullish fallback unchanged. No save/dirty/
reset/search/download handler changes or mutation of loaded translation maps.

## Product
Absent prototype-named columns no longer display object/functions as if stored
translations. Explicit own entries keep literal values. This is display safety,
not a locale-code policy change or a repair to imported source maps.

## Designer
Inspected desktop own/absent three-column fixture: own text visible, absent
inputs empty. Inspected390px regular-locale card: field labels/input/actions fit.
No new layout or responsive style changes.

## Security
Own-property check avoids inherited prototype values. Raw maps remain untouched.
No HTML/provider/credential, worker/license/spend/registration/sharing changes.
Does not change save semantics or claim broader prototype-hardening coverage.

## QA/integration
- Glossary17 suites251 tests: inherited prototype/ordinary properties ignored,
own special-name values preserved, own nullish/zero behavior retained.
- Actual browser19/0 includes own/absent special names, negative display mutation
and restoration, existing dynamic column/typed search/uncertainty/draft behavior,
zero reads/writes during projections. All temporary mutations restored.
- Production web build/docs4 checks/138routes/syntax/diff pass.
- Real API/PostgreSQL with local component fixtures, not a backend locale-policy
or full-product/native/sync/provider rerun. Latest full web728 baseline312 suites
3796 tests. Coverage22 FULL/7 PARTIAL/1 MISSING/external acceptance unchanged.

Five review perspectives complete with no remaining scoped issue before commit.
