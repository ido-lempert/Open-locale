# 0177 - Actual local apply serialization conflict

## Developer pass
Actual PostgreSQL conflicting update after Serializable snapshot makes production
raw SELECT FOR UPDATE fail as PrismaP2010/meta.code40001,notP2034. Service now maps
that exact known wrapper+SQLSTATE to409 alongside existingP2034. No message match,
catch-all database classification or automatic retry. Unexpected errors rethrow.

## Product pass
Concurrent change requires compare/review again,not retry of stale bytes. No partial
local writes or duplicate effects. Existing-key local apply only;worker defaultOFF,
no remote writes/baseline advance/accepted sync/external-account acceptance. Coverage
22FULL/7PARTIAL/1MISSING unchanged. This closes a measured conflict response gap,
not new sync capability.

## Designer pass
No UI layout change. Current480x900 confirmation pixels inspected:scope,digest,
effect warning and separate controls readable,no overflow. Browser108 retains real
cancel/set/removal/navigation coverage. README describes exact conflict wrapper.

## Security pass
Only known Prisma class/codeP2010 plus exact SQLSTATE40001 mapped;arbitrary DB
messages do not reach client or control classification. Production transaction
still aborts. Unrelated injected storage failure remains500/atomic rollback.
No new credential,scope,spend,registration,license or audience.

## QA/integration pass
Sync298->300. Test wraps transaction start to establish actual Serializable snapshot
with project read,then commits conflicting project update through another DB
connection before production lock executes. Captures actual Prisma error metadata,
checks conflict boundary reached/one transaction only/409. Separate assertion checks
value/history/TM/activity/intents unchanged. No syntheticP2034 error or DB double.
Initial1FAIL/299passes exposedP2010SQLSTATE40001 as unmapped;app corrected,300clean,
full sweep300clean. Actual HTTP storage failure500 test retained. No interruption111.
API248/30,web52/7,both builds,reaper4RC0.43integration/config legs14completed
fail-closed batches,all individual/outerRC0;48inventory. Webhook45,migration10,
automation116,sync300/browser108. Native staged116+128=244total/242unique,all242literal
source labels covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted.
No live fixture services/temp bundles.
