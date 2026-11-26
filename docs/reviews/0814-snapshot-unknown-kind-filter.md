# Unknown loaded snapshot kind filter

## Developer
Local unknown kind option accepts only nonboolean automatic metadata, while
manual/automatic keep strict false/true classification. No raw row changes.
Existing clear/project/destruction lifecycle reused. No capture/restore/API change.

## Product
Already explicit unknown metadata can now be isolated instead of mixed with
all kinds. Label search combines locally. Current reread retains filter and
shows no-match when all replacement rows have known kinds, not empty history.

## Designer
Actual1278px desktop/390px mobile screenshots inspected: selected unknown kind,
2-of3 scope, native controls and guidance wrap within viewport. No layout/CSS
change; existing restore identity remains separate and unchanged.

## Security
No string/number/object truthiness classification. Literal malformed timestamp
still escaped. Filter requests no new read/write, does not alter restore/capture
readiness, uncertainty or receipts. No provider/worker/license/spend/share change.

## QA/integration
- Snapshot15 unit suites175 tests pass, nonboolean matrix/search/raw identity/
departed unknown-kind handler included.
- Actual local API/PostgreSQL metadata browser13/0 final, known-kind browser12/0,
production web build/docs4 checks/138routes/syntax/diff pass.
- Initial metadata browser12PASS1FAIL: negative removed marker DOM node, which
Angular correctly did not recreate when tracked rows remained. Probe changed
to blank/restore marker text; final13/0. No app correction for fixture failure.
- No whole-web/full-product/native/sync/provider/all-backend rerun claim.
Latest whole-web747312 suites3832 tests; coverage22 FULL/7 PARTIAL/1 MISSING/
defaultOFF/external acceptance unchanged.

Five review perspectives complete, no remaining scoped failure before commit.
