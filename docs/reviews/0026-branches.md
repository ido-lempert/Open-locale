# 0026 - Branching: branches with admin-gated merge

## What shipped
- `Branch` model: per project, unique (projectId, name), cascade delete with its keys. Every project
  has a `main` branch (created with the project; backfilled by migration for existing projects).
- Keys are scoped to a branch: uniqueness moved from (projectId, name) to (branchId, name).
- API: GET/POST `/projects/:id/branches` (create admin-only, name `[a-zA-Z0-9_-]{1,40}`),
  DELETE `branches/:branchId` (admin, `main` refused), POST `branches/:branchId/merge` (admin).
- Merge semantics (admin-gated, under project lock, activity `branch.merged`): for each key name in
  the source branch, upsert into the target branch and copy each translation (value + status, only
  for locales the target project has). Keys existing only in the target are kept. Nothing is
  deleted; the source branch stays as it was. A merge is a copy-forward, not a git-style merge:
  there is no base/commit history, so "target had a different newer value" is not detected -
  source value wins per locale.
- Keys list/create take `branch` (default `main`); unknown branch names 404. Import (json/csv/
  android/ios) and export (json/csv/android/ios) take `?branch=`. QA runs per branch.
- Snapshots capture the branch per key/translation; restore is branch-aware: it re-creates a
  deleted branch by name and upserts keys per (branch, name). Pre-branching snapshots (no branch
  recorded) restore into `main`. Restore deletes keys absent from the snapshot across ALL branches
  - it does not prune keys from one branch based on another branch's absence.
- Web editor: branch selector in the toolbar, inline "Add branch", and a "Merge X into main"
  button shown on non-main branches with an explicit confirm describing the copy semantics.

## Explicit limits (tested behavior, not broader)
- TM, comments, tasks, glossary, screenshots, webhooks, and API tokens remain project-wide - they
  do not fork per branch. Activity entries record the branch name in details where relevant.
- Merge is admin-only; there is no per-branch permission split.
- The translation review workflow (bulk mark) operates on the currently visible branch's keys only,
  since key listing is branch-scoped.
- Restore can leave an extra empty branch behind if a branch was created after the snapshot and is
  absent from it; branches are cheap and admin-deletable.
- No branch rename, no cross-project branches, no merge conflict UI beyond the confirm dialog.
