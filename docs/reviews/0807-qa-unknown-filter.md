# Local QA unknown issue filter

## Developer
Explicit local `unknown` filter uses same string-only known-type predicate as
badge styling, not property lookup or coercion. Known filters unchanged; raw
issues and full download remain untouched. Existing project/reset/destruction
filter lifecycle reused. Unknown is a UI sentinel, not a new API issue type.

## Product
Unknown/future/malformed findings already display neutral fixed labels721.
Now users can isolate them while combining literal loaded-key/locale/detail
search. Clear restores full rows, and no-match text describes local filters,
not a clean QA result. No API, persistence or newer-server-state promise.

## Designer
Inspected desktop1266px and mobile390px actual screenshots: explicit selection,
7-of13 desktop/1-of13 searched mobile counts, readable wrapping and focused
horizontal findings region. Existing detail overflow scroll is intentional.
No column or spacing changes. Native labelled select preserves keyboard use.

## Security
String-only allowlist excludes inherited names, objects, arrays, null and
numbers without coercion hooks. Literal detail markup remains escaped. Full
raw download continues private-content warning; no new request/write/share,
provider/credential/worker/license/spend changes.

## QA/integration
- QA8 unit suites58 tests pass; unknown/raw/coercion/search/no-match assertions.
- Actual local browser15/0, includes known/unknown filters, negative known-label
leak/restoration, unknown+search/clear, raw full download and exactly1QA read,
zero writes. Response fixture contains13rows with7unknown/malformed types.
- Existing type browser7/0 final exit0 and clear browser8/0; backendQA23 checks.
Initial type browser7PASS but cleanup wrapper forced descendants and exit1;
unchanged retry with NX_DAEMON=false exit0. No app/test fix for cleanup issue.
- Production web build pass; docs4 checks/138routes/syntax/diff pass. Desktop and
390px screenshots inspected. No whole-web/full-product/native/sync/provider/
all-backend rerun. Coverage22 FULL/7 PARTIAL/1 MISSING/external gaps unchanged.

Five review perspectives complete, no remaining scoped failure before commit.
