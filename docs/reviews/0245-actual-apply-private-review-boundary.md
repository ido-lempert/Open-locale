# 0245 - Actual local apply with coexisting prepared recovery

## Developer pass
Tests only. Prepare actual local apply from remote fixture changed existing value,
then prepare archived recovery independently. Hold actual authenticated apply POST,
verify archived private text/bindings/confirmation gone and scope reset before
response. Release real API transaction. Exact intended value/UNVERIFIED/history+1/
intent+1 asserted;unrelated archived deleted value remains absent/history0.
Remote fixture bytes restored only for later independent scenarios,not a remote
write. Subsequent audit page explicitly reloaded after apply's normal page clear.

## Product pass
Closes review0244's explicitly unit-only local-apply/private-review browser boundary.
Actual apply is a separate explicit confirmation,not recovery approval. Does not
restore archived value or complete sync. No app/server changes,remote write,
baseline advance,accepted sync or worker enablement.22FULL/7PARTIAL/1MISSING/default
OFF unchanged.

## Designer pass
Actual480x900apply-success/cleared-scope image inspected twice including final.
Full local-only result/count/sync-incomplete notice,refresh/audit/value-only scope
readable. No private review or recovery controls. Audit page cleared by existing
apply behavior,form continues below viewport,no horizontal overflow visible. Local
fixture data;no visual app change.

## Security pass
Coexisting reviews don't merge authority. Only confirmed apply sends;archived
review cleared before request result,never used for recovery. Exact DB effect
counts verify selected existing key changes and deleted preview key untouched.
No new grant/API or targeted negative-control claim. Server checks unchanged.

## QA/integration pass
Browser188->190(+2held-apply clearing/exact committed effects),initial/finalRC0.
Web104/7,API248/30 unchangedRC0.43unique integration/config legs in10completed green
batches,individual/outerRC0. Sync644,builds API/web,reaper4,docs4/138routesRC0. No
failures,startup issues,timeouts or interruption179. Existing~555kBvs500kB web budget
warning persists. Native STAGED116+128=244total/242unique supportedPG55534,inner/outer
RC0,checkpoint removed,not uninterrupted. No app/test changes afterward;web104/
browser190reran,then docs only. No external delivery or exactly-once claim.
