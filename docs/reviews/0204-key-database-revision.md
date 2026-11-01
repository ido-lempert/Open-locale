# 0204 - Database-owned key revision for internal recovery

## Developer pass
Additive keys.revision INTEGER default1 and BEFORE UPDATE trigger advance OLD+1.
Raw SQL/no-op/explicit reset updates cannot retain the old revision. Prisma schema
and generated client agree;internal diagnostic/lock/writer bind expectedKeyRevision
in addition to timestamp/branch/digest. Invalid revision values fail closed. Existing
writer and competing-connection fixtures bind their own current key revision.

## Product pass
Closes same-stored-timestamp metadata change/restore gap for ordinary updates.
Rollback restores revision with metadata. Conservative no-op invalidation is explicit.
Integer exhaustion fails closed,not wraparound. A privileged operator disabling the
trigger or rewriting schema remains outside the guard. No public restore/token or
repository effect composition,baseline advance or remote writes. Coverage remains
22FULL/7PARTIAL/1MISSING/defaultOFF. Migration locks keys:maintenance window required
for a populated deployment;no production deployment performed.

## Designer pass
No UI change. Actual480x900pixel eligibility screenshot inspected after current
sync-browser run:full UTC snapshot/not-live/refresh/no-reservation/no-restore notice,
metadata and button readable within card. Upper summary partly under sticky header;
full relevant card visible. Local fixture data,not production/user data.

## Security pass
DB-owned counter covers Prisma and raw SQL updates without depending on callers
remembering to increment. Current admin/scope and row locks remain in Serializable
transaction. Public preview whitelist excludes internal revision/timestamp/digest.
Trigger overflow returns PostgreSQL22003;update aborts without stale revision reuse.
No new external registration,credential scope,spend,license/audience or production
settings/data changes.

## QA/integration pass
Migration17->22:existing key metadata initial revision1,raw edit/restore attempted
reset increments to3 with unchanged stored timestamp,rollback,no-op increment and
actual22003 overflow denial. Sync429->437:actual two raw edits restore metadata and
preserve exact stored timestamp,revision advances twice despite reset attempt;
stale review denied,rollback preserves reviewed revision,invalid revisions denied.
Existing HTTP whitelist and writer rollback/races remain green.

Initial sync436pass/1fail and diagnostic436pass/1fail:JS Date bound to raw timestamp
shifted2h in fixture. Fixed fixture SQL to leave stored timestamp untouched,so test
isolates revision rather than accidentally depending on timestamp mismatch. No app
fix from this failure. Corrected/final437RC0. Three combined120sec call limits
interrupted automation,OIDC-link and2FA trailing legs. Automation retry initially
zero-check startup failed on stale socket referencing dead postmaster. Verified dead
processes,removed stale sockets and stopped interrupted local dev server;standalone
reruns132/12/37RC0. Completed earlier batches retained. Initial successful webbuild/
reaper shell had detached-child cleanup outer failure;both repeated under reaper,
webbuild repeated fresh with cache skipped. No false green from incomplete calls.

Final43unique integration/config legs in16completed batches,each individual and
outerRC0. Extra migration run22RC0. API248tests/30suites,web65/7,both builds,reaper4RC0.
Sync437,browser138,automation132,webhook45,135routes. Native staged116+128=244total/
242unique labels,all literal labels covered,inner/outerRC0,checkpoint removed.
Staged,not uninterrupted. No app edits after initial build or broad verification;
fixture correction and added migration tests preceded their final verification.
Only documentation/review added afterward.
