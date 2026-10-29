# 0043 — Task chaining (dependencies)

Tasks can declare a single predecessor in the same project; a chained
task cannot start until its predecessor is DONE. First half of the
capability map's "tasks with locks and chaining".

## What changed

- `tasks.dependsOnId` (migration `20261029074500_task_chaining`), self
  FK ON DELETE SET NULL, CHECK forbidding self-dependency.
- API: create/update accept `dependsOnId`. Validation: predecessor must
  be in the same project (400) and adding the link must not create a
  cycle (walked with a visited set, 400). Transition into IN_PROGRESS
  is rejected (400) while the predecessor is not DONE; the predecessor
  status is read inside the same transaction as the status update.
- Responses include `dependsOn { id, title, status }`; task.updated
  audit events record dependency changes by title.
- Tasks UI: new-task form gains a "Depends on (optional)" select;
  chained rows show a "waits on: <title> (<status>)" chip; a blocked
  start attempt surfaces the server error in the page alert.

## Review pass notes

- Developer: single-predecessor model (matches Lokalise's chained
  tasks); cycle check is O(chain length) with a visited set so a
  corrupted cycle cannot loop the query.
- PM: starting is the gated transition; reopening a predecessor does
  not retroactively pause dependents (documented limit, same as
  Lokalise, which treats the chain as a start gate).
- Designer: one more form select following the established pattern;
  the chip is a muted text line, no new layout.
- Security: cross-project predecessor ids rejected (400); dependency
  info is project-scoped data already visible to every member. No new
  query surface - dependsOn rides the existing list response.
- QA: tasks-test +7 checks (chain create, blocked start, start after
  done, cycle + self rejected, foreign rejected, delete-predecessor
  clears via SET NULL, audit by title); e2e-visual +2 checks (chip
  renders after form creation, blocked start surfaces the server
  message in the UI).

## Limits

- Single predecessor only; no multi-dependency DAG.
- Reopening a DONE predecessor does not revert started dependents.
- Dependency cannot be edited from the task row (only at creation or
  via the API); row editing is a future UI slice.
- Task locks (preventing edits to keys in a task's scope) are the
  remaining half of the capability-map item and are not in this slice.
