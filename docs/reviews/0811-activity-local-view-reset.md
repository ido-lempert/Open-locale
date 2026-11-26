# Activity local view reset

## Developer
Separate local control clears query and restores loaded display order, without
calling API or touching server filters, pages, cursor, read/error state or
download feedback. Destroyed callbacks return before changes. Whitespace-only
query remains clearable. No reuse of server Clear activity filters read action.

## Product
Local search/order can now be reset together while preserving loaded scope.
Explicit copy separates local reset from action/actor/key clearing and fresh
activity reads. Download bytes and existing requested-file feedback unchanged.
Available during pending/failed read without implying data loaded successfully.

## Designer
Actual desktop1278px and390px screenshots inspected. Reset sits beside Clear
local search, with described scope below; controls and multiline guidance fit.
Native labelled order/search controls retained. No modal needed because only
reversible local display choices change, not text drafts or stored activity.

## Security
No new request/write/download/share, provider/credentials, worker/license/spend
changes. Local reset preserves server scope and metadata-only downloads. Browser
restores temporary anchor download stub before real departure regression.

## QA/integration
- Activity6 unit suites101 tests: ready/loading/error state preservation,
whitespace query and destroyed reset, plus existing97 tests.
- Actual local metadata/reset/departure browser12/0: six loaded rows restored,
exact action/actor/key filters and download feedback preserved, one initial
activity read/zero writes. Retained-order negative fails predicate then reset
restores it, no negative mutation retained.
- Existing current-page clear/recovery/pagination13/0 and order12/0 browsers.
Production web build, docs4 checks/138routes/syntax/diff pass.
- No whole-web/full-product/native/sync/provider/all-backend rerun claim.
Latest whole-web743312 suites3825 tests; coverage22 FULL/7 PARTIAL/1 MISSING/
defaultOFF/external acceptance unchanged.

Five review perspectives complete, no remaining scoped failure before commit.
