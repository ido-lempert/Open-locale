# OTA failed next release preserves retained bundle

## Developer
Extend real payload UPDATE failure fixture to an existing version1 with edited
source. Retained list identity/count, exact latest body/ETag, conditional304,
missing version2 and unchanged release audit verified before trigger removal.
Retry uses version2, exact edited special-key payload and two success audits.
Old pinned version1 body and validator remain immutable. App source unchanged.

## Product
A failed next publish cannot replace the last usable release with empty data,
consume version2 or claim success. Successful explicit retry becomes latest
without changing retained version1. No auto-retry behavior introduced.

## Designer
Backend test only, no UI or screenshot inspection claim.

## Security
Fixed local-only SQL trigger and function cleaned up in finally; private test
DB removed after suite. Existing authorization/pin/integrity tests stay green.
No provider/worker/license/spending/sharing/credential-scope changes.

## QA/integration
Real PostgreSQL/HTTP76 checks =68 prior+8 new pass. Targeted mutation commits
only version2 placeholder outside transaction:6 new regression assertions fail,
while earlier first-publish rollback checks remain green. Restored app source
rebuilt and all76 rerun green. Build/syntax/diff/docs pass. No browser/whole-
web/native/provider rerun claim. Latest six-flow checkpoint77885 assertions,
units6/55; whole-web772315/3863. Existing22FULL/7PARTIAL/1MISSING/defaultOFF/
external gaps unchanged. Five reviews complete before commit, no findings.
