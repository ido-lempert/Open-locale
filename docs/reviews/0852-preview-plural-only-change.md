# Import preview counts plural-only changes

## Developer
Preview compared only plain value while actual import also compares plural
forms. Use same canonical forms comparison and own-entry lookup, preserving
plain-entry behavior and jsonb key-order independence. No write added to
preview. Existing parsed formats without plurals remain unaffected.

## Product
PO edit changing one form while other/plain value stays equal is shown as a
write rather than unchanged. Actual counters agree; preview after explicit
import reports unchanged. Does not claim all import validation parity or
reserve data against concurrent edits.

## Designer
Backend preview-counter correction, no UI/layout/screenshot claim.

## Security
Preview remains read-only. Own-entry metadata lookup avoids inherited special
names. No auth/provider/worker/license/spending/sharing/token-scope changes.

## QA/integration
Actual PostgreSQL/HTTP formats230 checks =226 prior+4 new pass. Baseline2
targeted failures: missed plural-only write and mismatch with actual counters.
Checks preserve exact keys/forms and import-run count during preview, then
explicit import and repeated preview. API build/syntax/diff/docs pass. No
browser/whole-web/native/provider rerun claim. Latest format units78511/108,
focused browsers13assertions. Existing22FULL/7PARTIAL/1MISSING/defaultOFF/
external gaps unchanged. Five reviews complete before commit, no findings.
