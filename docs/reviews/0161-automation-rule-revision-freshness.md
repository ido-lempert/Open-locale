# 0161 - Captured automation rule freshness

## Developer pass
Before each captured rule executes, service re-reads enabled/project/trigger and
revision. Missing/disabled/changed rule aborts remaining aggregate; no new rule
added mid-run is included. Authenticated PATCH increments revision atomically,
including name-only/no-op updates. Stable createdAt/id order retained. Additive
migration supplies revision1 for existing/new rows; generated client and build
checked. Direct unsupported DB edits bypassing revision are not API-edit fencing.

## Product pass
Captured configuration is never silently replaced by a new version mid-run:
change fails closed; a new trigger may use new configuration. Disable/restore or
config-edit/restore still aborts old capture. Earlier effects remain. Not per-rule
retry deduplication, transactional whole-run rollback or overall sync completion.
No enabled worker/public apply/baseline advance/remote write/external acceptance.
Coverage22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI change/control. Current native1280x800 editor screenshot inspected: locale
columns, saved label and memory suggestion readable without overlap. Existing UI
evidence only, no new visual-feature claim. README/plan distinguish freshness from
retry completion.

## Security pass
Actual authenticated PATCH/DELETE during first committed rule activity changes
next captured rule. Disable/delete/config/disable-restore/config-restore all stop
next task/activity. API updates increment revision1 or2; ABA cannot restore old
capture authority. Repository per-rule current-intent guard retained. Checks are
point-in-time: no claim edits after check or internal receiver retries are fenced.
No registration, credential scope, spend, license or audience changes.

## QA/integration pass
Automation46->55: five first-effect/second-suppression checks plus four authenticated
revision increments. First task and activity actually commit; wrapper injects HTTP
mutation while delegating real activity transaction. Second captured or edited-title
task absent and activity count exactly+1. Not external receiver/provider acceptance.
Migration8->10: applies actual migration prefix, seeds preexisting rule, deploys
new revision migration; verifies content preserved and revision1. Full e batch rerun.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs in14 final clean
fail-closed batches,all individual/outerRC0;48 inventory. Webhook45,sync268/browser98.
Native116+128=244 total/242 unique,all242 literal source labels covered,inner/outer
RC0,checkpoint removed. Staged,not uninterrupted. No test failure or host interruption95.
One harmless inspection named wrong migration script,corrected actual filename.
No active fixture services/temp bundles on completion.
