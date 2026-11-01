# 0167 - Intent-scoped successful automation rule checkpoints

## Developer pass
Optional ruleHandled/afterRule hooks leave normal callers unchanged. Repository
adapter reads intent/rule checkpoint and writes success only after rule effects/
activity complete, with live-token/deadline SQL fence. Unique(intentId,ruleId),
revision retained for audit; intent deletion cascades ledger. Additive migration
mirrored in Prisma,client/build/full deploy verified. No production timer.

## Product pass
Partial retry skips already checkpointed logical rule ID even if task closed or
rule edited;edited completed rule does not apply twice to one intent. Failed rules
retry current configuration. New rules may be included on retry (no frozen rule-set
snapshot). Summary succeeded includes previously handled rules,not new executions.
Crash after effect/activity before ledger still duplicates;not exactly-once or
whole-rule rollback. No public apply/baseline advance/remote write/external acceptance.
Coverage22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI. Current1280x800 editor screenshot inspected: readable locale columns,saved
state/memory suggestion without overlap. Existing UI evidence,not new feature.
README/plan state retry/checkpoint and crash-gap boundaries.

## Security pass
Current source/rule validation precedes ledger skip. Successful checkpoint requires
live matching token/deadline;expired post-effect lease leaves no rule ledger row.
No locks across effect/network. Intent FK cascade prevents orphan records. Direct
unsupported DB edits are outside API revision fencing. No registration/scope/
spend/license/audience changes. Post-check and crash races remain.

## QA/integration pass
Automation84->89: first actual task succeeds/later explicit notify aggregate fails,
only first rule checkpoint exists;close first task and edit first config through
authenticated API,repair later rule,then due retry creates only remaining actual
task without replaying first task/activity or edited-title task. Unique ledger two
successful IDs. Expired post-effect lease cannot write individual rule checkpoint.
Existing independent scenarios reuse one intent;fixture clears ledger at explicit
scenario resets only,not between partial-retry attempts. Failure notify double
remains labeled,not external acceptance.
Initial fixture passed85 then changed completed row to leased retaining finishedAt;
constraint rejectedRC1. Fixed fixture finishedAt=null,not app constraint.87clean
rerun,then added expired-ledger/API-edit assertions,final89clean sweep. No host
interruption101;failed-run temp bundles removed by clean rerun.
API248/30,web48/7,both builds,reaper4RC0.43integration/config legs14clean fail-closed
batches,all individual/outerRC0;48inventory. Webhook45,migration10,sync268/browser98.
Native116+128=244total/242unique,all242literal source labels covered,inner/outerRC0,
checkpoint removed. Staged,not uninterrupted. No active fixture services/temp bundles.
