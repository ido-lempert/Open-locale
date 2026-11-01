# 0166 - Explicit combined repository effect step

## Developer pass
Extract channel handlers shared by existing standalone steps and new combined
step. Combined invokes webhook then automation under one claimed lease/settlement.
Independent checkpoint code and guards unchanged. No timer/startup registration/
public route. Existing standalone webhook45 and automation cases remain green.

## Product pass
Successful first channel followed by failed second preserves first checkpoint;
due retry skips first while attempting remaining channel. Completed is handler
bookkeeping, not sync acceptance or delivery receipt. Partial-rule/crash-before-
checkpoint duplicates remain. No public apply/baseline advance/remote write/
external acceptance;22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI. Current native1280x800 editor screenshot inspected: readable locale columns,
saved state/memory suggestion without overlap. Existing UI evidence only, not a
new feature. README/plan state explicit invocation versus production timer.

## Security pass
Single leased runner validates current source before handling. Both channels keep
independent live-token/deadline checkpoint fences and per-effect guards. Changed
target stops before either channel. No locks across transport. No registration/
credential scope/spend/license/audience changes. Post-check and crash gaps remain.

## QA/integration pass
Automation78->84: combined actual signed local receiver+actual task/both checkpoints;
first HMAC; webhook checkpoint preserved after automation failure; due retry skips
receiver and creates remaining task; completed idle; changed target ineligible with
no receiver/checkpoint. Automation failure uses existing explicit notify aggregate
double; receiver/task success are real PG/TCP. Not external provider acceptance.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs14 clean
fail-closed batches,all individual/outerRC0;48 inventory. Webhook45,migration10,
sync268/browser98. Native116+128=244 total/242 unique,all242 literal source labels
covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted. No failing test
or host interruption100. No active fixture services/temp bundles on completion.
