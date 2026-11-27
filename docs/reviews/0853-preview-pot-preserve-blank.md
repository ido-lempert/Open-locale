# POT preview preserves existing nonempty values

## Developer
Actual POT import uses preserveOnBlank while preview previously counted a
blank template value as a replacement. After existing lock checks, apply the
same POT-only blank/nonempty condition to unchanged count. Fresh missing keys
still count as writes; existing blanks compare equal normally. Other formats
unchanged, no preview mutation.

## Product
Dry-run no longer implies template import will erase existing translations.
One existing nonempty special-name entry plus one fresh blank predicts one
write/one unchanged, matching actual counters. Repeat predicts both unchanged.
No full preview-validation parity or concurrent-state reservation claim.

## Designer
Backend preview counter fix only, no UI/layout/screenshot inspection claim.

## Security
Read-only preview retains locale grant/branch/lock checks. No auth/provider,
worker/license/spending/sharing/credential-scope changes. Local fixture only.

## QA/integration
Real PostgreSQL/HTTP formats234 checks =230 prior+4 new pass. Baseline3
new targeted failures: wrong initial/repeated preview and actual mismatch;
read-only keys/forms/run count check already passed. API build/syntax/diff/
docs pass. No browser/whole-web/native/provider rerun claim. Existing
22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five reviews
complete before commit; no scoped findings remain.
