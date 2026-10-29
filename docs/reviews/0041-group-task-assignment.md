# 0041 — Group task assignment

Tasks can now be assigned to a team group in addition to (never together
with) an individual member.

## What changed

- `tasks.assigneeGroupId` (migration `20261029065000_task_group_assignee`),
  FK to `groups(id)` ON DELETE SET NULL, plus a CHECK constraint
  `tasks_single_assignee` enforcing the member-XOR-group invariant at the
  database level, so no code path (including future ones and manual
  edits) can create a double-assigned task.
- API: create/update accept `assigneeGroupId`. Setting one kind of
  assignee clears the other. Group must belong to the project's team
  (400 otherwise); member+group together is a 400. `assigneeGroup` is
  included in list/create/update responses.
- Audit: task.updated events record `assigneeGroup` from/to by group
  name, and clearing switches record both sides.
- Tasks UI: both assignee dropdowns list groups after members as
  "Group: <name>"; the current value round-trips (a group-assigned task
  shows its group selected).

## Review pass notes

- Developer: single-assignee invariant enforced three ways: service
  guard, switch-clearing semantics, DB CHECK. createIn (automations
  path) accepts assigneeGroupId; automations do not pass it today.
- PM: matches Lokalise's "assign task to a team group" workflow; group
  membership changes do not retarget the task (assignment is to the
  group, not a snapshot of members) — same semantics as Lokalise.
- Designer: groups render in the same select with a "Group:" prefix;
  no new controls or truncation-sensitive layouts.
- Security: cross-team group ids rejected (400, same as cross-team
  member assignment). No new disclosure: group names are visible to any
  team member via the settings/groups endpoints already.
- QA: tasks-test extended (8 new checks): group create/assign, both
  rejected, foreign group rejected, member-clears-group,
  group-clears-member, list round-trip, audit trail.

## Limits

- ~~"My tasks" style filtering by group membership is not added~~ Stale:
  closed by 26de02e (mine = direct OR current group membership) and
  e97a09c (same-token join/leave flips results immediately).
- ~~Deleting a group audits only the group.deleted event~~ Closed by the
  0046 follow-up: each unassigned task gets its own task.updated audit
  row, and group.deleted carries unassigned counts.
