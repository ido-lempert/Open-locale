# Report heading field types

## Developer
Workflow and quality heading helpers accept unknown. Strings keep lowercase/
underscore display transforms, nonstrings get fixed unavailable text instead of
calling missing string methods. Raw arrays/maps and column identity untouched.

## Product
Malformed heading metadata no longer breaks the report screen. Valid unknown
strings keep readable original transforms, not mapped to invented known status.
No report recomputation, source repair, filters or raw-download changes.

## Designer
Inspected desktop populated malformed-header fixture and390px filtered-empty
screen. Fixed labels readable, many columns stay inside horizontal table scroll;
no whole-document overflow. Existing empty guidance/scope copy retained.

## Security
Display helpers do not coerce objects or run custom string conversion. No raw
HTML, credentials/provider, worker/license/spend/sharing/registration changes.
Raw private report downloads intentionally retain source metadata.

## QA/integration
- Report7 suites90 tests pass, including malformed values and throwing coercion
hooks for both helpers, valid known/unknown string transforms.
- Actual browser12/0: malformed headings, blank-heading negative detected/
restored, existing typed locale search, fixed scope, exact full raw report
metadata download and zero added reads/writes. Rerun green with screenshot.
- Production web build/docs4 checks/138routes/syntax/diff pass.
- Browser real API/PostgreSQL plus malformed heading/locales signal fixtures.
No full-product/native/sync/provider/backend rerun claim. Latest full web728
312 suites3796 tests. Coverage22 FULL/7 PARTIAL/1 MISSING and external gaps
unchanged. This guards heading display, not arbitrary malformed report schema.

Five review perspectives complete, no remaining scoped finding before commit.
