# 0306 - Task audit failure rollback

## Developer review
Test-only reverse failure proof for239's transaction boundary. Actual PostgreSQL
trigger rejects task.created audit INSERT after task creation. Both ordinary and
keyed HTTP requests return500; exact title counts prove task/event/link absence.
Removing trigger allows one keyedtask with exactly one link and one audit. No app,
API/query/schema change; trigger/function removed in finally and client closed.

## Product review
Creation cannot report success while missing its required audit if audit storage
fails. Recovery test confirms a later normal request works after failure removal.
No automatic retry, idempotency or complete historical coverage claim.

## Designer review
No UI change. Fresh480x900 existing keyedtask Activity screen inspected after final
browser regression: single literal-title row, selected action, refresh and timestamp
readable. No new visual design claim.

## Security review
Fault targets only task.created INSERT, not other audit events; own isolated DB
only. Database state assertions check both failed task paths and successful recovery.
No production trigger/migration, provider interaction, credential scope/spend/license
change. Original user upload authority recovered before commit.

## QA/integration review
API265/31/web195/11 uncached0/builds0. Tasks77->80; Activity22/reports118/sync644/
syncbrowser239/QA14 unchanged.45uniqueintegration/configlegs inner/outer0; reaper4/
docs4/138routes0. Native STAGED116+128=244total/242unique PG55534 inner/outer0/
checkpointremoved, not uninterrupted. No app/test edits after native. Bundle574.03kB
vs500warning unchanged. Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no remote/baseline advance/accepted sync/enabledworker.
Existing report snapshot/window caveats unchanged.

Chronology: standalone syncbrowser120s interrupted near final report checks, noFAIL.
Own Chrome4527/crashhandlers stopped; PG4408zombie/TCP55479closed verified, own
stale testlock/socket removed. Isolatedrerun239 inner/outer0. No check failures or
external writes affected. No other interruption this slice.
