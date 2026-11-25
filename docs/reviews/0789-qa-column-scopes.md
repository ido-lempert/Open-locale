# QA table column scopes

## Developer
Four existing headers declare scope col, no structural/data/state change.
Existing empty row colspan and horizontal keyboard region remain intact.

## Product
Explicit column relationships for loaded QA findings; no new finding types,
filters, counts or claim of fresh checks. Raw download and request scope stay.

## Designer
Inspected current desktop and390px focused/scrolling screenshots. Four columns
retain spacing, readable headers and literal details. Focus outline visible.
Mobile scroll intentionally clips columns inside the region, not the document.
Semantic attribute change produces no intended visual redesign.

## Security
No API/auth/data/credential/provider changes or new effects. Existing literal
interpolation and private download wording retained. No spend, worker or license.

## QA/integration
- QA web8 suites57 tests pass.
- Actual local browser13/0, including four exact named column scopes and missing
scope negative detected/restored. Existing keyboard/empty/download checks pass.
- QA backend integration against real PostgreSQL passes all existing assertions.
- Production web build passes; docs4 checks/138routes, syntax/diff pass.
- Screenshots inspected. Browser uses real API/PostgreSQL with QA GET fixture;
backend QA integration independently exercises actual saved checks. No whole-
product/native/sync/provider rerun claim. Coverage22 FULL/7 PARTIAL/1 MISSING
and external acceptance gaps unchanged.

Five review perspectives complete with no remaining scoped findings.
