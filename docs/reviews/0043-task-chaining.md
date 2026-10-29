# 0043 — Task chaining (dependencies)

Tasks can declare a single predecessor in the same project; a chained
task cannot start until its predecessor is DONE. First half of the
capability map's "tasks with locks and chaining".

## What changed

- `tasks.dependsOnId` (migration `20261029074500_task_chaining`), self
  FK ON DELETE SET NULL, CHECK forbidding self-dependency.
- API: create/update accept `dependsOnId`. Validation: predecessor must
  be in the same project (400) and adding the link must not create a
  cycle (walked with a visited set, 400). The chain gates every forward
  transition out of OPEN - both starting (IN_PROGRESS) and completing
  (DONE) - and attaching or changing the predecessor on a task already
  past OPEN: in all cases the (new) predecessor must be DONE (400
  otherwise), read inside the same transaction as the update.
  Reopening (any -> OPEN) stays allowed, so a completed chain can be
  walked back deliberately. Create cannot smuggle a status: the
  ValidationPipe whitelist strips unknown DTO fields, so every task is
  born OPEN regardless of a `status` key in the body (tested).
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
- QA: tasks-test +13 checks over the pre-chain baseline (chain create,
  blocked start, start after done, cycle + self rejected, foreign
  rejected, delete-predecessor clears via SET NULL, audit by title,
  status smuggling on create stripped, OPEN->DONE bypass rejected,
  unfinished predecessor attach on a running task rejected, done
  predecessor attach allowed, simultaneous cycle creation yields
  exactly one winner, final graph verified acyclic); e2e-visual +2
  checks (chip renders after form creation, blocked start surfaces the
  server message in the UI). A failed row edit reverts the control to
  the last server-known value (ngModel alone cannot push back an
  unchanged model; verified live that the select reads the server
  value after a 400).
- Concurrency: dependency writes and chain-gated status transitions
  take a per-project advisory lock (`pg_advisory_xact_lock` on
  hashtext(projectId || '::task-graph'), the same pattern the
  automations slice uses) inside the writing transaction, before the
  cycle walk and the predecessor-status read. Two simultaneous opposing
  updates (A->B, B->A) serialize: the second walk observes the first's
  committed edge and is rejected. Tested: parallel opposing PATCHes
  yield exactly one 200 and one 400, and the resulting graph is
  verified acyclic by walking the final state. Reopening a predecessor
  concurrent with a dependent starting also serializes on the same
  lock: either the reopen lands first (start rejected) or the start
  lands first (reopen proceeds; the documented no-retroactive-pause
  product limit applies).

## Follow-up: row-level dependency editing

Each task row now carries a "waits on" select listing every other task
in the project with its status, plus "no predecessor" to clear. It uses
the existing PATCH /tasks/:id dependsOnId support - same-project and
cycle validation apply unchanged. A rejected change (e.g. a cycle)
reverts the select to the last server-known value and shows the API
error in the page banner. Verified by e2e: create-time predecessor
rendering, re-point, clear, and cycle rejection + revert.

## Limits

- Single predecessor only; no multi-dependency DAG.
- Reopening a DONE predecessor does not revert started dependents.
- Task locks (preventing edits to keys in a task's scope) are the
  remaining half of the capability-map item and are not in this slice.
