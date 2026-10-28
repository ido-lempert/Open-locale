# 0026 - Branching: branches with admin-gated merge

## What shipped
- `Branch` model: per project, unique (projectId, name), cascade delete with its keys. Every project
  has a `main` branch (created with the project; backfilled by migration for existing projects).
- Keys are scoped to a branch: uniqueness moved from (projectId, name) to (branchId, name).
- API: GET/POST `/projects/:id/branches` (create admin-only, name `[a-zA-Z0-9_-]{1,40}`),
  DELETE `branches/:branchId` (admin, `main` refused), POST `branches/:branchId/merge` (admin).
- Merge semantics (admin-gated, session principals only, under project lock, activity
  `branch.merged`): copy-forward, not a git-style merge. For each key name in the source branch,
  upsert into the target branch and copy each translation (value + status) and key metadata
  (description, plural, max length, tags - source wins). Keys existing only in the target are
  kept. Nothing is deleted; the source branch stays as it was.
- Merge safety: POST `branches/:id/merge/preview` returns the exact diff counts (keys created/
  existing, translations added/overwritten/identical, target-only keys) plus `previewAt` (DB-server
  time). The executing merge takes an automatic whole-project snapshot first (restorable, same
  rule as imports), writes a translation-history row with the previous value and the merging user
  for every overwrite, and - when the client passes `previewedAt` back - skips (and reports as
  `keysSkipped`/`translationsSkipped`) any target key or translation written after the preview.
  The skip check compares each row's own pre-write updatedAt, never the upsert's own bump. An
  unguarded merge (no previewedAt) overwrites, but the overwritten value stays in history.
- Branch management endpoints (`/branches*`) require a session principal: JwtAuthGuard plus
  SessionOnlyGuard, so API tokens - including read+write tokens - get 403 on list/create/delete/
  preview/merge. The `?branch=` parameter on keys/import/export stays token-usable for CI.
- Branch creation makes an EMPTY branch: it does not copy main or any other branch (no fork).
  The UI says so in the button, the placeholder and the creation notice.
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
- The review bulk mark takes a `branch` parameter (default main) and scopes its raw SQL to that
  branch's keys: a bulk mark on a feature branch cannot touch same-named main keys, on both the
  filter path and the keyIds path. Tested: same-named key on both branches, bulk on the branch,
  main row verified unchanged.
- Restore can leave an extra empty branch behind if a branch was created after the snapshot and is
  absent from it; branches are cheap and admin-deletable.
- No branch rename, no cross-project branches, no merge conflict UI beyond the confirm dialog.
