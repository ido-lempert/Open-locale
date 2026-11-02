# 0234 - HTTP recovery revocation during actual lock wait

## Developer pass
Tests only. Hold actual project row FOR UPDATE,start HTTP recovery,observe a
PostgreSQL Lock waiter on project FOR UPDATE,then commit direct-admin demotion or
membership removal in blocker transaction. HTTP request uses original JWT/body.
Restore original membership after assertions. No app instrumentation or hooks.

## Product pass
Both waiting requests return409 without fresh row or changed recovery counts;
absence generation retained. Later ordinary authorized success remains covered.
No new API/UI behavior,remote work,baseline advance or worker enablement.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
No UI change. Actual480x900 screenshot inspected:focused read-only review,target/
path/UTC/no-reservation/no-restore-UI notice,escaped value/controls readable,no
horizontal overflow. First heading partly behind sticky header,second card below
viewport. Screenshot not a mutation test.

## Security pass
Unlike completed-before-request revocation cases,this observes actual public
recovery waiting before revocation commits. Transaction snapshot semantics can
reject through serialization as well as current-role conflict;assert409 and
unchanged effects,not one specific internal rejection path. Wait observation is
on the test database's project-lock query and isolated to these fixtures. No
targeted negative-control claim this slice.

## QA/integration pass
Sync642->644(+2waiting revocation),initial/finalRC0.43unique integration/config
legs in11completed green batches,individual/outerRC0. Browser156,API248/30,
web77/7,both builds,reaper4,138routes allRC0. Migration22,automation132,
webhook45. No failures,startup issues,timeouts/interrupted calls. Native staged
visual116+128=244total/242unique,all242literal labels present,inner/outerRC0,
checkpoint removed. Staged,not uninterrupted. Only docs changed after final
integrations;docs/API build rechecked precommit. No external acceptance claim.
