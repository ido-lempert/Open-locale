# Preview task lock precedes plural validation

## Developer
Use existing nonadmin locale-granted member and task-locked key. Submit invalid
plural without other plus unchanged neighbor. Preview and actual import must
report task lock, zero creates/writes, one failed and one unchanged. Exact
key/form state preserved. App implementation unchanged.

## Product
A locked key gives actionable task guidance rather than unrelated forms error,
matching actual import. Closes790 explicitly deferred lock-precedence proof.
No broad validation parity/concurrent reservation claim.

## Designer
Backend test only, no UI/layout/screenshot inspection claim.

## Security
Real member authority and task lock exercised, not owner bypass. Preview adds
no run or data writes; actual failed key does not mutate existing data. No
auth/provider/worker/license/spending/sharing/credential-scope change.

## QA/integration
Actual PostgreSQL/HTTP formats269 checks =265 prior+4 new pass. Mutation skips
preview lock for parsed plural maps: exactly targeted guidance assertion fails,
while counter/data checks still pass. Restored app source rebuilt and269 green.
Build/syntax/diff/docs pass. No browser/whole-web/native/provider rerun claim.
Existing22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five
review perspectives complete before commit; no scoped findings remain.
