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
- Security: this is a convenience filter, not a privacy boundary - the
  unfiltered list already shows every team task with its assignee, so
  the filter adds no information and withholds none. There is no
  `assignee=<other user>` parameter; the only supported value is `me`,
  resolved from the caller's token. Project membership is still
  enforced by getFor before any query.
- QA: tasks-test +6 checks (mine includes group-assigned, excludes
  others' and unassigned, owner direct-only, composes with status, and
  consecutive queries across a live leave/rejoin flip the result with
  the same token - no re-login); e2e-visual +2 checks (filter hides a
  group task for a non-member, "everyone" restores it).

## Limits

- No email/notification side effects; "mine" is a view filter only.
- ~~The filter is not persisted across page loads~~ Fixed in the
  follow-up below.

## Follow-up: filter persistence

The assignee and status filters persist per project in localStorage
(`ol.taskFilters.<projectId>`), restored before the first fetch on the
next visit. Stored values are whitelisted on restore (OPEN/IN_PROGRESS/
DONE, "me"); corrupt or unavailable storage falls back to the defaults.
Persistence is best-effort (private mode/quota simply skips it). Scope
stays a view filter - no server state, no notifications. Verified by
e2e: both filters survive a full page reload with the list reflecting
the persisted filter; filters are reset to defaults afterwards.
