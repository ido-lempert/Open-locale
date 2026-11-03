# 0298 - Activity action vocabulary

## Developer review
Added11 missing action labels/options for screenshots/tasks/glossary/embed-origin/
pretranslation/automation. One unit reads actual server-declared vocabulary and
asserts exact option-set match, readable labels and unknown-action fallback. This
is declared-action parity, not proof every production emitter is declared. No
API/query/schema change. Corrected copied harness heading from QA to Activity.

## Product review
Users can filter existing emitted event kinds instead of only seeing them in all
activity. Actual local task create emits task.created; dropdown selection sends
that query and renders exactly one created-task event. This adds filtering/labels,
not new action detail fields or activity retention guarantees.

## Designer review
Fresh480x900 fullpage inspected: created-task selected label, actor and event row
readable; wrapped filter/header layout unchanged. No document overflow. Action
labels use plain verbs; unknown future labels still fall back to raw action name.

## Security review
Same read-only activity query and permissions. Local fixture creates task only in
isolated test database. No account/scope/spend/license change, no new data fields
or external communications. Owner original and todo rechecked.

## QA/integration review
Web176->177/11 vocabulary unit; activity8->9 actual task-create/filter proof.
API265/31/reports118/sync644/syncbrowser239/QA14 unchanged.45uniqueintegration/
config legs completed inner/outer0, no failures/timeouts/interruption.
Builds/reaper4/docs4/138routes0. Native STAGED116+128=244total/242unique PG55534
inner/outer0/checkpointremoved, not uninterrupted. No app/test edits after native;
finalactivity9 rerun0. Bundle572.02kBvs500warning(previous571.60). Docker static
only/no daemon claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged;
no remote/baseline advance/accepted sync/enabledworker.
