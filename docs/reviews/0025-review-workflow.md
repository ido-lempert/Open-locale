# 0025 - Review workflow: custom statuses and review queue

## What shipped

- Translation status is no longer a fixed enum: base statuses UNVERIFIED/TRANSLATED/REVIEWED plus per-project custom statuses (`Project.customStatuses`). Migration `20261028224500_review_workflow` converts `translations.status` and `translation_history.status` to text and drops the enum; validation moved into the API.
- Admins manage custom statuses in project settings (`PATCH /projects/:id` with `customStatuses`; names must match `^[A-Z][A-Z0-9_]{1,23}$`, base names rejected).
- Status transitions validate against base + the project's list (single `PATCH .../status` and the new bulk endpoint).
- Review queue: `POST /projects/:id/review/bulk-status` sets one status across a locale's translations. The update is ONE atomic `UPDATE ... RETURNING` whose WHERE re-checks every condition at write time: the given locale, current status = `from` when given, non-empty value (empty translations are never marked), and keys matching the visible `search`/`tag`/`keyIds` filters. `dryRun: true` returns the affected count plus a DB-server UTC timestamp; the editor previews that count with the explicit scope in a confirm dialog, then commits with `notChangedSince` set to it. The commit WHERE adds `updatedAt <= previewAt`, so any row written after the preview - a same-status value edit, an ABA status round-trip, or a newly matching row - is excluded (updatedAt bumps on every write; the timestamp is produced and compared as a naive UTC literal because the column is timestamp-without-tz holding UTC wall time, so no session-timezone conversion can shift the window). The count in the dialog is exact for the committed set. One history row per actually-updated translation, one activity event. Gated by the same locale-write checks as every translation write, so locale-restricted members can only run it on granted locales.
- Key status filter accepts custom values.
- Web: settings "Review statuses" panel; editor status dropdowns (filter + per-cell) include custom statuses; when the status filter is active the toolbar shows a review-queue bar (locale + target status + "Mark all").

## Review passes

- Developer: one validation helper used by both transition paths; bulk is one transaction; rows already at the target are skipped so repeated runs are no-ops.
- PM: matches the plan's review-workflow item: custom statuses per project and a per-language review queue with bulk transitions.
- Designer: queue bar appears only when a status filter is active; statuses panel sits with the other settings panels; copy notes removal does not rewrite existing translations.
- Security: status names validated server-side (DTO + service); custom-status management is admin-only; bulk transitions respect per-locale write restrictions (tested with a restricted member on granted and denied locales).
- QA/integration: `scripts/review-workflow-test.mjs`, 18 checks over real HTTP and a migrated real PostgreSQL: admin gates, name validation, base-name collision, custom status accepted/rejected, bulk counts and idempotency, history rows, other locales untouched, restricted-member bulk, removed custom status keeps existing rows but is rejected for new writes, key list filter by custom status.

- Orphan statuses (a custom value removed from settings, or restored from a snapshot) stay on their translations, remain filterable, and display in the editor as "name (removed)".
- Snapshot restore writes statuses verbatim, including custom or since-removed ones; it does not revalidate against the current settings list.
- The migration is verified on an existing database (seeded enum rows survive the enum->text conversion as text, the enum type drops, custom statuses work after), not only on fresh installs (`scripts/migration-status-test.mjs`).

## Scope limits

- Removing a custom status from settings does not migrate translations that carry it; they keep the value and remain filterable, but the status can no longer be set until re-added.
- The bulk endpoint covers one locale per call; there is no cross-locale batch.
- No review assignment: the queue is a filtered editor view plus bulk transition, not a task-routing system (tasks exist separately).
