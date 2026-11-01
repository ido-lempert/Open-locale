# 0171 - Bounded validated repository rule selection

## Developer pass
Parser requires array of unique case-insensitive UUID strings,length<=1000. Empty
array valid. Selection reads at most1001 rows then parser rejects overflow before
manifest write. Stored malformed data rejected before fire. No dynamic SQL or new
public controls. Existing guards/ledger unchanged.

## Product pass
Empty first selection remains empty after new rule creation,never widens to all.
Oversized selection fails rather than silently dropping rules.1000 UUIDs serialize
within39KB. No production timer/public apply/baseline advance/remote write/external
acceptance. Crash gaps remain;22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI. Current native1280x800 editor screenshot inspected: readable locale columns,
saved state/memory suggestion without overlap. Existing UI evidence,not new feature.
README/plan state bound and empty-manifest semantics.

## Security pass
Bad shape,invalid UUID,case-insensitive duplicate and oversize stored manifest fail
closed before actual activity. Actual1001 eligible DB rules rejected with manifest
stillNULL and no task. Limits bound selection materialization,not all automation
rule creation. No credential/scope/spend/license/registration/audience changes.

## QA/integration pass
Automation102->109: empty stored manifest no widening;four malformed variants deny
before activity;first zero-rule selection stays empty after actual new rule;actual
1001 eligible rules reject without manifest/effects. Initial108clean,then overflow
DB case added,final109clean. Existing labeled failure doubles/real-task/offline MT/
real-socket/contention cases retained. No failure/interruption105.
API248/30,web48/7,both builds,reaper4RC0.43integration/config legs14clean fail-closed
batches,all individual/outerRC0;48inventory. Webhook45,migration10,sync268/browser98.
Native116+128=244total/242unique,all242literal source labels covered,inner/outerRC0,
checkpoint removed. Staged,not uninterrupted. No active fixture services/temp bundles.
