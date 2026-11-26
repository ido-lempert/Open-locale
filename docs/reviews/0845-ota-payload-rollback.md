# OTA payload-write rollback proof

## Developer
Real PostgreSQL BEFORE UPDATE OF payload trigger fails the second stage of
publication persistence. Test queries committed storage directly and real
list/latest/activity APIs: no placeholder row, no release audit, no readable
empty bundle survives. Remove trigger/function in finally, then retry and
verify version1, exactly one audit and original special-key integrity checks.
App source unchanged; no production fault path added.

## Product
A failed first publish cannot appear as a usable empty release or consume
its version number. Explicit retry produces the complete release. Existing
immutability, pinning, retention and concurrency tests remain green.

## Designer
Backend test only, no UI change or screenshot inspection claim.

## Security
Database fault is local test-only fixed SQL with no external interpolation.
HTTP500 does not expose trigger exception marker. Fixture database is deleted
on cleanup; trigger and function removed before retry. No auth/provider,
worker/license/spending/sharing/credential-scope change.

## QA/integration
Final actual PostgreSQL/HTTP68 checks =62 existing+6 rollback/retry checks.
Mutation moves initial publication insert outside transaction: nonzero exit
with7 failures, including4 targeted rollback/version checks and3 downstream
integrity/metadata checks. Restored source rebuild and68-check rerun pass.
Build, syntax/diff/docs checks pass. No browser/whole-web/native/provider
rerun claim; latest six-flow checkpoint77885assertions. Existing coverage
22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five reviews
complete before commit; no scoped findings remain.
