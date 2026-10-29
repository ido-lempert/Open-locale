# 0042 — "Assigned to me" task filter (includes group assignments)

Closes the limit documented in 0041: group assignment was a display and
ownership marker only, with no way to see "tasks I am responsible for".

## What changed

- `GET /projects/:id/tasks?assignee=me` returns tasks assigned directly
  to the caller OR to any group the caller belongs to (Prisma relation
  filter on `assigneeGroup.members`, resolved in the same query - no
  N+1). Composes with the existing `status` filter.
- Tasks UI: a second header filter, "everyone / assigned to me",
  alongside the status filter.

## Review pass notes

- Developer: one additional where clause; no schema change, no new
  endpoint. Membership is evaluated at query time, so joining or
  leaving a group immediately changes what "mine" returns - no cached
  snapshot to go stale.
- PM: matches the Lokalise "My tasks" view semantics; a team member
  sees group work routed to them without anyone reassigning it.
- Designer: filter is a plain select next to the existing status
  filter; no new layout (verified wrapping at 480px in the previous
  slice's shots of the same header pattern).
- Security: the filter only ever narrows by the *caller's* id; there is
  no `assignee=<other user>` parameter, so it cannot be used to probe
  other members' workloads beyond what the full list already shows.
  Project membership is still enforced by getFor before any query.
- QA: tasks-test +4 checks (mine includes group-assigned, excludes
  others' and unassigned, owner direct-only, composes with status);
  e2e-visual +2 checks (filter hides a group task for a non-member,
  "everyone" restores it).

## Limits

- No email/notification side effects; "mine" is a view filter only.
- The filter is not persisted across page loads (resets to "everyone").
