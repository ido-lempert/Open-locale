# 0229 - Explicit target-scoped local recovery API

## Developer pass
New POST repository-targets/:targetId/deletion-audits/:auditId/recover-local uses
UUID path parameters,validated flat reviewed bindings and exact confirmation
recover-local-value. Actor/project/target/audit derive from session/path,not body.
Calls existing captured-scope executor without refreshing reviewed state. Typed
service review input narrowed to required facts;one Serializable transaction.

## Product pass
Session direct-admin explicitly restores one bounded flat archived locale value
only when original key/branch/value and target/baseline bindings still match and
absence generation is current. Fresh unverified row/new history/activity/TM/one
pending effect intent commit atomically. Archive retained,no old history replay.
No new keys,remote read/write,baseline advance,accepted sync or worker enablement.
No restore UI action yet. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
Older review notes are historical;current README/PLAN clarify new API.

## Designer pass
No UI change. Actual480x900 screenshot inspected:existing read-only archived review
result,target/path/UTC/no-reservation/no-restore-UI notice,escaped value and controls
readable,no horizontal overflow. First heading partly behind sticky header,second
card extends below viewport. UI fixture does not exercise the new mutation.

## Security pass
Session-only;current direct admin rechecked in locked transaction. API tokens,
members,outsiders and group-only admins denied. Forged body actor/value/project
stripped and cannot steer scope/value. Explicit confirmation and bounded positive
revisions/digests/UUID/timestamp formats validated. Stale bindings/replay409;
unsupported400;busy/serialization409;unknown faults remain500 with rollback.
Review facts are not bearer tokens. No auto-retry or refresh of stale review.

## QA/integration pass
Sync602->625(+23HTTP cases). Initial622 before group/UUID/no-store additions,
final625RC0. Rebuilt API negative control replaces exact confirmation check with
string-only:621pass/4expectedfailRC1. Bad confirmation then commits too early,
causing unchanged-denial-count and later first-success expectations to fail.
Restored source/rebuilt,fixed625RC0. Actual HTTP commit/replay tests inspect row,
authenticated history/intent actor,retained archive and removed absence marker.
Service-level storage fault/lock/serialization rollback tests remain green;not
claiming HTTP injected-fault or actual public-route concurrent-race coverage.
43unique integration/config legs in11completed green batches,individual/outerRC0.
Browser156,API248/30,web77/7,both builds,reaper4 allRC0. Migration22,
automation132,webhook45,138routes. No startup issues,timeouts/interrupted calls.
Native visual staged116+128=244total/242unique,all literal labels present,
inner/outerRC0,checkpoint removed. Staged,not uninterrupted. After these runs only
documentation changed;docs/API build rechecked before commit. No external acceptance.
