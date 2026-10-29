# 0046 — Group deletion: per-task unassign audit

Reconciling 0041 against 26de02e/e97a09c showed one genuinely open
limit: deleting a group SET NULLs its tasks' assigneeGroupId, and only
the group.deleted event recorded it - the tasks' own change history was
silent.

## What changed

- `deleteGroup` now counts tasks assigned to the group, audits up to 50
  of them individually (`task.updated` with
  `changes.assigneeGroup = { from: <group name>, to: null }`), and the
  `group.deleted` detail carries `tasksUnassigned` (true total) and
  `tasksAudited` (how many got individual rows - a gap means capping
  kicked in).
- The activity feed rendered task.updated events with a blank detail
  (no formatter case). It now formats the changes map generically
  (`field: from → to`, null as "none", arrays joined) - this covers
  dependsOn/title/dueDate/lockedKeys/assigneeGroup changes alike - and
  group.deleted shows the unassigned task count.

## Review pass notes

- Developer: count + capped findMany inside the deletion transaction;
  audit rows commit or roll back with the delete. truncate() reused
  from activity.service. A task assigned to the group concurrently with
  the delete can slip between count and delete (READ COMMITTED);
  worst case is an audit count off by the racing window - audit
  metadata, not a security invariant.
- PM: matches the feed's existing conventions (task.updated already
  used for dependency/lock-set changes); capping at 50 keeps a mass
  unassignment readable.
- Designer: null renders as "none", not the string "null"; group.deleted
  stays one line with the task count appended.
- Security: no new data exposure - same project-scoped feed, group name
  and task titles were already visible to project members.
- QA/integration: tasks-test +4 checks (delete accepted, task
  unassigned, per-task audit row from->null, group.deleted counts);
  e2e-visual +1 (feed renders dependsOn change detail from real
  dependency edits).
