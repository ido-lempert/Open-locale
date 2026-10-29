# 0047 — Concurrent assignment race loser: clean 409

0046 closed the assignment-vs-group-delete race with the advisory
shared/exclusive pair, but the losing side surfaced as a raw 500 (FK
violation after the lock wait) - an expected user-path error wearing a
server-error status.

## What changed

- `rethrowUnlessAssigneeGroupDeleted` maps exactly one error to 409
  Conflict ("Assignee group was deleted concurrently; retry with a
  current group"): Prisma P2003 whose message or meta names the exact
  constraint `tasks_assigneeGroupId_fkey`. Everything else - a different
  constraint, a different Prisma code, a non-Prisma error - rethrows
  unchanged, so no unrelated DB failure is ever masked as a client
  error.
- The mapper wraps the two assignment writes: `tx.task.create` in
  `createIn` and `tx.task.update` in `update`. Both already take the
  shared advisory lock when `assigneeGroupId` is set, so the only way to
  reach this FK through the API is the race itself (the group pre-check
  passed, then the group was deleted before the write reached the row).

## Verification

- Deterministic fault injection (tasks-test): a raw Prisma transaction
  holds the exclusive assignment lock and deletes the group underneath
  a blocked PATCH. The loser returns 409 with the clear message, never
  500, and the task ends unassigned. This exercises the real HTTP
  service path; only the adversary's delete is raw, because the app
  cannot open the window through its own API.
- Nondeterministic race check tightened: the concurrent PATCH/DELETE
  pair may now settle only as 200 or 409 on the assign side (500 is
  rejected), with the audit-row requirement unchanged when the assign
  wins.
- Mapper narrowness (unit): P2003 on the assignee-group constraint maps
  (message and meta shapes); P2003 on `tasks_assigneeId_fkey`, a P2002
  naming the same constraint, and a non-Prisma error all rethrow the
  original object unchanged.
- Audit/count semantics from 0046 unchanged: the exact RETURNING count
  and the 50-row cap are untouched; the 409 path performs no partial
  write (the tx rolls back with nothing committed).

## Review pass notes

- Developer: `.catch` on the write itself, not the whole tx, keeps the
  blast radius at the one statement that can raise this FK.
- PM: the message tells the user what happened and what to do (retry
  with a current group), matching the other concurrency 409s (duplicate
  group name).
- Designer: no UI change; the tasks UI surfaces server messages in its
  existing error slot.
- Security: no information leaked beyond what the caller already knows
  (they named the group); status-code honesty - an expected conflict is
  no longer reported as a server fault.
- QA/integration: tasks-test 75 checks (+2: deterministic 409 loser,
  loser ends unassigned; the nondeterministic check tightened in
  place); unit-api 43 tests (+5 mapper cases in a new spec).
