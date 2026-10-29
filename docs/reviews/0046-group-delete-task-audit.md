# 0046 — Group deletion: per-task unassign audit + assignment race closure

Reconciling 0041 against 26de02e/e97a09c showed one genuinely open
limit: deleting a group SET NULLs its tasks' assigneeGroupId, and only
the group.deleted event recorded it - the tasks' own change history was
silent. A follow-up review flagged the remaining race: a task assigned
to the group concurrently with the delete could slip between the count
and the delete, making tasksUnassigned an observed count rather than an
exact one.

## What changed

- `deleteGroup` runs inside one interactive transaction:
  1. takes `pg_advisory_xact_lock(hashtext(projectId + '::task-assignment'))`
     (exclusive),
  2. unassigns with `UPDATE tasks SET assigneeGroupId = NULL ... RETURNING
     id, title` - `tasksUnassigned` is the exact RETURNING set, not an
     observed pre-read,
  3. audits up to 50 of the returned tasks individually (`task.updated`
     with `changes.assigneeGroup = { from: <group name>, to: null }`),
  4. records `group.deleted` with `tasksUnassigned` (exact total) and
     `tasksAudited` (how many got individual rows - a gap means capping
     kicked in), then deletes the group.
- The assignment side closes the race: `createIn` and `update` take
  `pg_advisory_xact_lock_shared` on the same key whenever
  `assigneeGroupId` is set (covers UI and automation callers). Shared
  vs exclusive serializes assignment against deletion: an assignment
  either commits before the delete's exclusive lock is granted (and is
  then inside the exact RETURNING set) or waits and fails on the FK
  after the delete commits. No lock-ordering cycle: the exclusive side
  (deleteGroup) takes no other advisory lock.
- The activity feed renders task.updated change detail generically
  (`field: from → to`, null as "none", arrays joined - covers
  dependsOn/title/dueDate/lockedKeys/assigneeGroup) and group.deleted
  shows the unassigned task count.

## Verification

- Race: tasks-test fires PATCH assign + DELETE group concurrently.
  Observed settle: delete 200, assign rejected (500 on the FK after the
  lock wait), task ends unassigned. Assertion requires the consistent
  outcome, not a specific interleaving: delete 200 AND final
  assigneeGroup null AND (assign not 2xx OR a per-task audit row
  from->null exists). Tested interleavings, not a formal proof.
- Cap: 51 tasks in a group, delete it - tasksUnassigned=51,
  tasksAudited=50, exactly 50 per-task audit rows, and all 51 tasks
  verified actually unassigned afterwards.
- Rollback: the unassign UPDATE, audit inserts, group.deleted record
  and group delete share one interactive transaction, so a failure
  anywhere rolls back all of it. Commit-direction atomicity is verified
  via the API checks above (delete + audits + unassign all visible
  together). No fault-injection harness exists to force a
  mid-transaction failure through the service path, so the rollback
  claim rests on the single-transaction structure, not on an induced
  rollback.
- Feed: e2e-visual fixture creates group "audit-demo" with an assigned
  task, deletes it, and the feed check + screenshot
  (editor-33-activity-task-audit.png) show the group.deleted row
  ("audit-demo" ... 1 task(s) unassigned) and the task.updated row
  (Audit demo task - assigneeGroup: audit-demo → none) with names, not
  IDs.

## Review pass notes

- Developer: exclusive lock taken first inside the tx; counts come from
  the mutating statement (UPDATE ... RETURNING). The losing side of the
  race currently surfaces as a 500 (FK violation after the lock wait) -
  consistent, though a cleaner 4xx mapping is a possible follow-up.
- PM: matches the feed's existing conventions; capping at 50 keeps a
  mass unassignment readable while the exact total stays disclosed.
- Designer: null renders as "none", not the string "null"; group.deleted
  stays one line with the task count appended.
- Security: no new data exposure - same project-scoped feed; group name
  and task titles were already visible to project members. The advisory
  pair is fail-safe: a forgotten shared lock on a new assignment path
  degrades to the FK safety net (SET NULL), never to a wrong count.
- QA/integration: tasks-test 73 checks (+3: race settle, cap disclosure,
  all-unassigned); e2e-visual 131 checks (+3: fixture delete, feed
  group.deleted row, feed task.updated row). Suite pagination artifact
  fixed on the test side (tail feed assertions now filter per action -
  the cap fixture's ~103 events pushed unfiltered checks off page 1).
