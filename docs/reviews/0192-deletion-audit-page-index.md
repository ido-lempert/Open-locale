# 0192 - Ordered deletion audit page index

## Developer pass
Replace project/timestamp prefix index with project/timestamp/UUID B-tree matching
both metadata page order columns after project equality. Ascending B-tree supports
backward descending scan. Create replacement before dropping redundant prefix.
No runtime query or data write change. Prisma schema and SQL migration agree.

## Product pass
Supports older metadata discovery on larger audit tables. No total-runtime guarantee:
PostgreSQL selects its own plan. Transactional CREATE INDEX may block writes,so README
requires a maintenance window for large existing tables. No external deployment/data
action performed. No restoration,remote write,baseline advance,accepted sync or
external acceptance. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
No UI changes or audit-list claim. Current actual480x900 repository summary inspected:
counts/checkpoints/timestamps/full notices readable,separate buttons,no overflow.
Native staged116+128=244total/242unique,all242literal labels covered,inner+outerRC0,
checkpoint removed. Staged,not uninterrupted.

## Security pass
Index contains existing project/metadata ordering keys,not archived values. Existing
session-admin scoping,explicit metadata-only select,cursor validation remain intact.
No registration,credential-scope expansion,spend,license/audience changes.

## QA/integration pass
Migration14->17:real historical-prefix seed audit preserves key name/locale/actor/
timestamp/full value/history snapshot through complete migrations;replacement index
columns verified in pg_indexes and redundant prefix absent. Sync360->362:20k mixed-
project rows,actual emitted Prisma first/older-page SQL+params replayed through pg
extended-query protocol in EXPLAIN ANALYZE,ordered index used without Sort. Not a
handwritten SQL analogue or forced planner setting. Fixture rows removed afterward.

Final43integration/config legs in14completed failclosed batches,all individual+outer
RC0. API248/30,web55/7,both builds,reaper4RC0(48nonvisual inventory). Migration17,
sync362,browser118,automation132,webhook45,134routes. No app edits after broad run.

Chronology:initial fixture parse failed0checks due duplicate LocalSyncPreviewService
binding;aliased import. Next224checks then raw Prisma EXPLAIN replay failed42883 UUID/
text parameter typing;switched fixture replay to pg's inferred parameter types,exact
emitted SQL unchanged. Full362green. Snapshots transient55452 bind conflict0checks,
complete d batch rerun28green. h+i+j combined call exceeded120sec:h reached marker,
i interrupted during oidc-link browser,j not begun. Reaped i rerun then standalone
link failed startup0checks with stale55480 socket/lock referencing killed defunct
PID7053. Confirmed defunct,removed stale resource,terminated interrupted orphan
Chrome;full i recovered49+12green. Standalone j55green. No app failure/fix from these
fixture/startup/interruption issues. All final outer return codes captured0.
