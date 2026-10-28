# 0024 - Granular permissions: roles and per-locale contributor access

## What shipped

- `TeamMember.allowedLocales: String[]` (empty = all locales). Migration `20261028223000_member_locale_access`.
- Roles: OWNER (project creator; immutable), ADMIN (full project administration), MEMBER (translation writes).
- Project administration now requires OWNER or ADMIN: project update/delete, locale add/remove, webhook create/update/delete, snapshot restore, member management.
- MEMBER with a non-empty `allowedLocales` can only write those locales: translation upsert, status changes, all four import formats (JSON/CSV/Android XML/iOS strings), and key deletion are checked server-side before any write (`assertLocaleWrite`). Key deletion requires write access to every project locale because it destroys all locales' data.
- Member management API: `GET/POST /projects/:id/members`, `PATCH/DELETE /projects/:id/members/:userId`. Unknown users and non-members both return 404 (no membership disclosure). Owners cannot add themselves a second membership, cannot be demoted or removed; admins cannot remove themselves or the owner; locale grants are validated against the project's locales.
- Web: settings page gains a Members panel (list with role and locale scope, role select, remove, add-by-email form with role and locale list).

## Review passes

- Developer: all writes re-checked server-side; `requireAdmin` and `assertLocaleWrite` are the single gates used by every route in scope.
- PM: matches the plan's Phase 2 permissions item; member management is admin-only, translation contribution is the MEMBER role.
- Designer: panel placed with the other settings panels; owner row shows no destructive controls; copy states the MEMBER/ADMIN boundary.
- Security: 404 for non-members on every project route (no existence leak); role changes and locale widening take effect on the next request (checked per request from the DB, no token-embedded roles); removal revokes access immediately.
- QA/integration: `scripts/permissions-test.mjs`, 24 checks over real HTTP: member CRUD, role gates on admin routes, locale-restricted writes/imports/status, widening and removal taking effect, removed member losing access.

- API tokens (X-Api-Key) are USER-scoped: a token authenticates as its owning user on every project that user can access. There is no bypass: every route checks membership role and locale grants per request from the database, so a token inherits its owner's current restrictions. A token minted before a restriction, demotion or removal is bound by the new state on its very next request (no token-embedded roles to go stale).

## Team model

Membership is TEAM-wide: a team owns projects, and TeamMember (role + allowedLocales) is keyed on the team. Adding a member through one project grants access to every project in that team, and locale limits apply across all of them. The settings UI states this explicitly. A member of one team has no access to another team's projects (404). Per-project membership is future work.

## Scope limits

- Snapshot capture/list are member-level operations; snapshot payload content has no read endpoint (list returns counts only), so locale-restricted members cannot read other locales through snapshots. Restore is admin-only.
- No multi-team/organization model beyond one membership list per team.
