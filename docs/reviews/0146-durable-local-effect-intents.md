# 0146 - Durable pending local-change effect facts

## Developer pass
Reviewed transaction composition inserts one intent per rederived local operation
in the same Serializable transaction after the writer. No-op has zero intents;
local-generation rejection prevents replay duplicates. Intent insertion failure
aborts the value/history/activity writes too. Scalar lineage retains exact actor,
target, key, branch, locale and reviewed digest/fingerprint. Empty set text stays
an empty string; removal is null. SQL check constrains operation/value shape.

## Product pass
These are pending facts, not successful deliveries, jobs or execution grants.
No dispatcher/public caller exists; retry, retention, current authority checks and
webhook/automation routing remain integration work. No baseline advance or remote
write. Project deletion removes private payloads; key/target deletion keeps their
lineage. Coverage22FULL/7PARTIAL/1MISSING unchanged, no external acceptance.

## Designer pass
No UI changes or apply button. Existing repository browser98 retained; README and
plan explicitly state there is no dispatcher or delivery claim. No screenshot is
presented as a new UI feature in this slice.

## Security pass
No network delivery while database locks are held. Payloads stay private in the
project with project cascade, no new API/credentials/audience. Exact reviewed
scope is checked by current locked admin/target/baseline guard before writes.
Intents are facts, not authority to send after later account/config changes.
Future dispatch must check current routing/permission and define deduplication,
retry and retention. No worker is enabled by merely adding the table.

## QA/integration pass
Sync207->217 real PG: post-write rollback leaves no intent, database trigger injects
intent-storage failure and proves value/history/activity rollback, exact set
context, stale replay no duplicate, no-op zero, removal null, removal rollback,
empty set preserved, key/target deletion lineage and project payload cascade.
API248/30, web48/7, both builds and reaper4 RC0.43 integration/config legs in14
completed clean fail-closed batches, all individual/outer RC0,48 sweep inventory.
Native visual116+128=244 total/242 unique, all242 source labels covered, inner/outer
RC0 and checkpoint removed. Staged verification, not uninterrupted. Browser98
retained. TM15442/visual15434 isolated overrides.

Interim verification failure disclosed: overlarge e/f/g shell hit host120sec after
e/f completed and interrupted OIDC startup. The next OIDC run failed at zero checks
on its stale55472 socket lock. Verified owning PID was zombie and TCP port unused,
removed only that dead run's socket/lock. OIDC55 then passed; final entire g batch
OIDC55/SAML55/groups44/plural65 passed RC0. Neither interrupted nor zero-check run
counted green. No application change was needed for this fixture cleanup.
