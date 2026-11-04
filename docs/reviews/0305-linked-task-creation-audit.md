# 0305 - Linked-task creation audit

## Developer review
Moved existing task.created record before optional key-link insertion/re-read,
removing early return's audit omission. All remain in caller transaction; no extra
record on unkeyed path. Actual API linked task creates exactly one audit. No schema,
query or API shape change. No history backfill.

## Product review
New tasks with linked keys now appear in Activity like ordinary tasks. Existing
snapshot title/actor/action semantics retained. This fixes future keyed creations,
not previously missing history or complete audit coverage. Automations use same
transactional helper; unchanged automation integration132 confirms no regressions.

## Designer review
Fresh480x900 actual linkedtask Activity capture inspected: single created-task row
and literal title, filters/refresh/time readable with no new overflow. No UI change.

## Security review
Task, creation audit and key links remain one transaction. A real PostgreSQL trigger
rejects task-key INSERT after audit; HTTP500 leaves zero matching tasks and zero
matching creation events. Failure injection is local isolated fixture only, removed
in finally. No credential scope/spend/license/provider action. Original owner upload
authority recovered before commit.

## QA/integration review
API265/31/web195/11 uncached0/builds0. Tasks75->77 exact-one-audit and realDB rollback;
Activity21->22 actual API keyedtask visible once. Reports118/sync644/syncbrowser239/
QA14 unchanged.45uniqueintegration/configlegs inner/outer0, reaper4/docs4/138routes0.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved,
not uninterrupted. No app/test edits after native. Bundle574.03kBvs500warning
unchanged. Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/1MISSING/
defaultOFF unchanged; no remote/baseline advance/accepted sync/enabledworker.
Existing report snapshot/window caveats unchanged.

Chronology: initial tasks35PASS/1FAIL used actor.id instead of actual actorId and
wrong SQLtable TaskKey instead of mapped task_keys; fixtureerror aborted suite1.
Same batch Activity22 inner0, batch1; reaper forced leftover descendant cleanup1.
Inspected API/schema, corrected fixture only, tasks77 isolated then fullbatch0;
final Activity22 rerun0. No timeouts/interruption or application changes after fix.
