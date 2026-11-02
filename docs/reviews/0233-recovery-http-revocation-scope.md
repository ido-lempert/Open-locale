# 0233 - Recovery HTTP revocation and route scope

## Developer pass
Tests only,no app changes. Original session and reviewed body reused after actual
committed admin demotion/removal. Original membership restored in finally using
stored record. Separate other-project target/audit fixtures plus missing UUIDs
exercise actual path scope;cleaned in finally. Existing later successful request
still proves restored authorized flow.

## Product pass
Demoted admin403,removed member404;missing/cross-project target/audit409. No local
recovery effects or new value,absence marker retained. No new API/UI behavior,
remote work,baseline advance or worker change. Coverage22FULL/7PARTIAL/1MISSING,
worker defaultOFF unchanged.

## Designer pass
No UI change. Actual480x900 fixture screenshot inspected:focused read-only review,
target/path/UTC/no-reservation/no-restore-UI notice,escaped value and controls
readable,no horizontal overflow. First heading partly behind sticky header,second
card below viewport. Screenshot not a mutation test.

## Security pass
Original JWT is not sufficient after current database role/membership revocation.
Wrong-project resource IDs cannot redirect recovery or disclose private fixture
archive text. Each case verifies unchanged recovery counts and original locale
absence;revocation also verifies retained generation marker. No targeted negative
control claim this slice. Existing internal locked revocation tests remain.

## QA/integration pass
Sync636->642(+2revocation,+4route scope),initial/finalRC0.43unique integration/
config legs in11completed green batches,individual/outerRC0. Browser156,
API248/30,web77/7,both builds,reaper4,138routes allRC0. Migration22,
automation132,webhook45. No failures,startup issues,timeouts or interrupted calls.
Native staged visual116+128=244total/242unique,all242literal labels present,
inner/outerRC0,checkpoint removed. Staged,not uninterrupted. Only docs changed
after final integrations;docs/API build rechecked precommit. No external acceptance.
