# 0316 - Glossary list failure and retry

## Developer review
Independent listError avoids mixing read failure with mutation messages. Fetch
clears stale rows, announces loading and fences latest read/destroy. Retry uses same
read and retains draft/mutation error. Three units/new13th web suite. New isolated
Chrome/API/PG harness demonstrates successful create followed by failed listread
and held retry. No API/schema. Reused-route/metadata/mutation lifecycle remain open.

## Product review
Failure must not leave old terms looking current or claim empty success. Fixed
list guidance says no terms shown and offers explicit Retry glossary. No automatic
retry or mutation retry. Browser fixture's first draft is deliberately persisted by
existing create action to trigger refetch; second unsaved draft survives retry.

## Designer review
Read status/error uses existing visual vocabulary with main busy and explicit retry.
Inspected actual480x900 recovered screenshot: second draft retained, both persisted
terms/translation fields/notes fit, no horizontal overflow. No redesign.

## Security review
Raw injected list exception private-glossary-detail absent from actual page. Reads
fenced on destroy/latest request. Existing mutation exceptions and metadata/project
routing not covered by this slice. Isolated local fixtures only; no external provider/
account/scope/spend/license change. Original owner upload recovered; live main checked.

## QA/integration review
API265/31/web223->226/12->13 uncached0/builds0. New glossarybrowser5 final0. Tasksbrowser23/
Activity22/QA14/reports118/sync644/syncbrowser239 unchanged.47unique integration/config
legs including new browser and docs inner/outer0; reaper4/0/docs4/138routes0. Native
STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted.
No app/test edits after native; no failures/timeouts/interruption250. Bundle577.34->
578.18kB vs500warning. Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no remote sync/accepted sync/baselineadvance/enabled
worker. Existing report snapshot/window caveats unchanged.
