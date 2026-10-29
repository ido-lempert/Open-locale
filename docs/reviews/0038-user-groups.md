# Review 0038 - User groups (effective-grant union)

Slice: named groups inside a team that carry a role + locale restriction; a
user's effective grant is the union of their direct team membership and
their group grants. PLAN.md: "Granular permissions: per-language
contributor access, groups, admin roles".

## Developer
- New models Group/GroupMember (team-scoped, unique team+name, cascade
  deletes) with hand-written migration; `memberFor` now computes the
  effective grant (strongest role wins; MEMBER-level effective role takes
  the union of locale lists, empty list = unrestricted; ADMIN/OWNER
  always unrestricted, as before).
- Routes: GET/POST /projects/:id/groups, PATCH/DELETE /projects/:id/groups/:gid,
  PUT/DELETE .../members/:userId; OpenAPI entries added; `test:groups` script.
- Prisma select fixed to `displayName` (verified by the suite's 500 trace).

## PM
- Delegation is visible: group list shows every group with its members and
  grants; a manager can see exactly what a group confers.
- Changes apply immediately (live DB re-check per request, same pattern as
  direct membership) - verified by the promote/demote checks.
- Not in this slice: groups management UI (next slice), group-based
  assignment in tasks/filters.

## Designer
- No user-facing UI in this slice; API + generated docs only.

## Security
- Teamwide membership remains the outer boundary: adding a non-team user to
  a group is rejected, and removing a team member cuts access even while a
  stale group row exists (tested at the HTTP boundary, 404 no-leak).
- No sideways escalation: an admin cannot create, edit, or delete a group
  whose role is at or above their own effective role; OWNER-role groups are
  impossible; a MEMBER cannot manage groups at all (all tested: 403/400).
- Group operations are scoped to the project team (wrong-team group id =
  404). Duplicate names conflict (409). Existence does not leak (404 for
  non-members).
- Group `allowedLocales` is team-level data and intentionally not validated
  against a single project's locales (a locale may exist in only some
  projects); enforcement intersects at write time, so an unknown entry can
  only ever shrink, never widen, access.

## QA / integration
- scripts/groups-test.mjs: 34/34 PASS on real PG + HTTP - list/manage
  authz, rank rules both directions, union semantics (ar + he, en denied),
  live promotion/demotion, group removal vs direct grant survival, outer
  boundary after team removal, no sideways enrollment into a protected
  ADMIN group (self or other, before and after a refused demote),
  cross-team group id = 404, cross-team user enrollment rejected,
  API-token discipline (read-only token lists but cannot mutate; a write
  token owned by a MEMBER still cannot manage groups), delete.
- Wrapper audit: every scripts/*-test.mjs exits nonzero on failure
  (verified individually); the old sweep additionally lost command exit
  codes behind a grep pipe, so a crash printing no FAIL lines could read
  green. Sweep rewritten to require rc=0 AND zero FAIL lines per leg,
  with per-leg logs under /tmp/sweep-legs/. Full sweep run separately.
