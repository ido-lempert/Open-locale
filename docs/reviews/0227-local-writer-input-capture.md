# 0227 - Local writer owns its snapshot and changes

## Developer pass
Structured-clone the typed precondition snapshot and change array at writer entry,
before the guard can yield. Captures nested key/translation rows and change objects,
not only outer containers. Guard, validation, writes, TM, history, activity and
result counts now use the same entry inputs. No caller changes to public routes.

## Product pass
Internal writer hardening only. Existing repository composition already copies
its inputs. No new restore action, remote write, baseline advance or worker change.
Coverage22FULL/7PARTIAL/1MISSING,worker defaultOFF unchanged.

## Designer pass
No UI change. Actual480x900 fixture screenshot inspected:focused result,target/
path/UTC and no-reservation/no-restore notice wrap readably,escaped value and
controls visible,no horizontal overflow. First heading partly behind sticky
header;second card extends below viewport.

## Security pass
Actual PostgreSQL transactions mutate caller locale,nested reviewed value and
next change value after a real guard query or after actual translation upsert.
Assert exact original English row/new history/activity and unchanged Hebrew row.
Then deliberately roll back and compare real rows/history/activity/TM/audit/intent
counts. Query/upsert completion instrumentation,not an actual lock-wait race or
HTTP exploit claim. Old-source control593pass/2expectedfailRC1 exactly entry-
binding checks;rollback checks stay green. Fixed source restored,final595RC0.

## QA/integration pass
Sync591->595(+2boundary entry-binding checks,+2rollback checks),initial/finalRC0.
Browser156,API248/30,web77/7,both builds,reaper4 allRC0. All43unique integration/
config legs in11completed green batches,each individual+outerRC0. Migration22,
automation132,webhook45,137routes. No startup issues,timeouts or interrupted calls;
no failures beyond intentional old-source control. Native visual staged116+128=
244total/242unique,all242literal labels present,inner+outerRC0,checkpoint removed.
Staged,not uninterrupted. No app edits after final integration runs;docs only
followed. No production/external acceptance claim.
