# Preview validates imported plural forms

## Developer
Extract existing import CLDR category/required-other checks into shared pure
error helper. Preview runs it after existing-key lock check and before missing
key/write counting. Actual per-key transaction uses same helper/messages.
Invalid new keys remain rolled back, valid neighbors retain partial semantics.

## Product
Android preview no longer predicts successful writes for invalid locale forms
or missing other. Mixed invalid/valid payload predicts PARTIAL with one failed
and one created/written key, matching actual import. No full validation-parity
or concurrent-state guarantee claim.

## Designer
Backend counters/error fix, no UI/layout/screenshot claim.

## Security
Read-only preview retains grant, branch and lock checks; validation shared
without loosening actual writes. No provider/worker/license/spending/sharing/
credential-scope changes, all fixed local fixtures.

## QA/integration
Baseline4 targeted failures across unsupported-category and missing-other
preview/actual counts. Fixed actual PostgreSQL/HTTP formats257 checks =249
prior+8 new pass. Preview storage unchanged and invalid keys never committed.
API build/syntax/diff/docs pass. No browser/whole-web/native/provider rerun.
Existing22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five
reviews complete before commit; no scoped findings remain.
