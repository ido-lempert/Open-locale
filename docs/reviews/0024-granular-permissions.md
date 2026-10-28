# 0024 - Granular permissions: roles and per-locale contributor access

## What shipped

- `TeamMember.allowedLocales: String[]` (empty = all locales). Migration `20261028223000_member_locale_access`.
- Roles: OWNER (project creator; immutable), ADMIN (full project administration), MEMBER (translation writes).
- Project administration now requires OWNER or ADMIN: project update/delete, locale add/remove, webhook create/update/delete, snapshot restore, member management.
- MEMBER with a non-empty `allowedLocales` can only write those locales: translation upsert, status changes, and JSON/CSV imports are checked server-side before any write (`assertLocaleWrite`).
- Member management API: `GET/POST /projects/:id/members`, `PATCH/DELETE /projects/:id/members/:userId`. Unknown users and non-members both return 404 (no membership disclosure). Owners cannot add themselves a second membership, cannot be demoted or removed; admins cannot remove themselves or the owner; locale grants are validated against the project's locales.
- Web: settings page gains a Members panel (list with role and locale scope, role select, remove, add-by-email form with role and locale list).

## Review passes

- Developer: all writes re-checked server-side; `requireAdmin` and `assertLocaleWrite` are the single gates used by every route in scope.
- PM: matches the plan's Phase 2 permissions item; member management is admin-only, translation contribution is the MEMBER role.
- Designer: panel placed with the other settings panels; owner row shows no destructive controls; copy states the MEMBER/ADMIN boundary.
- Security: 404 for non-members on every project route (no existence leak); role changes and locale widening take effect on the next request (checked per request from the DB, no token-embedded roles); removal revokes access immediately.
- QA/integration: `scripts/permissions-test.mjs`, 24 checks over real HTTP: member CRUD, role gates on admin routes, locale-restricted writes/imports/status, widening and removal taking effect, removed member losing access.

## Scope limits

- API tokens (X-Api-Key) are project-scoped and are not restricted by member locale grants; token management is session-only and admin-gated via the UI, but a token itself carries project-level write. Per-token scoping is future work.
- No multi-team/organization model; one team per project.
