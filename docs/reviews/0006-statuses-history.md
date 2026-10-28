# Review 0006 - Translation statuses + version history

Scope: UNVERIFIED/TRANSLATED/REVIEWED status per translation, full append-only history
with actor, per-cell status control and per-key history view in the editor.

## Pass 1 - Developer
- Schema: TranslationStatus enum + translation_history table (FK to the translation's
  composite key, cascade; actor FK set-null on user delete). Migration 20261028170000.
- History is written transactionally with the change it records; re-saving an identical
  value adds no entry (proven). Editing text resets status to UNVERIFIED - new wording
  is definitionally unreviewed (proven).
- History endpoint capped at 50 entries, newest first, includes actor display name.

## Pass 2 - Product manager
- Status semantics match Lokalise's unverified/translated/reviewed baseline.
- Accepted limitation, recorded: bulk JSON import does not write per-key history entries
  (would flood the log); imports will be covered by the Phase 1 activity log instead.

## Pass 3 - Designer
- Status is a compact labeled select (not a color-only dot) - explicit, keyboard and
  screen-reader accessible, colored left accent (gray/blue/green) as a secondary cue.
- History expands inline under its key row; values truncate with ellipsis, RTL preserved,
  empty values shown as "(empty)".

## Pass 4 - Security researcher
- History exposes actor display name and email domain only to project members; cross-team
  reads and writes are 404 (proven in status-history-test).
- History is append-only: no endpoint edits or deletes entries.

## Pass 5 - QA / integration
- status-history-test.mjs (real PostgreSQL + HTTP): 9/9 - initial UNVERIFIED, actor on
  first write, identical-value no-op, status change + invalid status 400, edit resets
  status, full ordered sequence, cross-team 404 on status and history.
- e2e-visual.mjs 19/19: status change through the UI select, history panel lists the
  change with actor and value; screenshot visually inspected (no secrets).
- Web unit 4/4; authz 28/28; integration 7/7; builds green.

All findings fixed or recorded with their phase. Clean rerun achieved.
