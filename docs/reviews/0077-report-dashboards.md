# 0077 — Reports: quality, usage and task dashboards

## Scope
Closes the audited reporting partial with three per-project dashboards beside
the existing progress report, each an aggregate over data members already see:

- **Quality** (`GET /projects/:id/reports/quality?branch=`): runs the same QA
  engine as `GET /qa` - no duplicated check semantics - and aggregates
  findings by type and locale, with total issues and distinct affected keys.
- **Usage** (`GET /projects/:id/reports/usage?days=`): activity volume over a
  trailing window (default 30 days, clamped 1-90): totals by action, per-day
  series, top 5 actors, distinct active keys (keyName snapshot, survives key
  deletion).
- **Tasks** (`GET /projects/:id/reports/tasks`): status totals
  (OPEN/IN_PROGRESS/DONE), overdue (past due, not done), due within 7 days,
  open work per assignee including an explicit "unassigned" row.

## Web
The reports page (header now "Reports") shows the three sections under the
progress table: quality per-locale x type matrix, usage action and actor
tables, task summary with the overdue count in the error style when nonzero.
Quality follows the branch selector like progress does; usage/tasks are
project-wide.

## Boundaries
- No persisted analytics, no charts library, no export; server aggregates on
  read. Usage window is fixed-default with a capped override, not arbitrary
  date ranges.
- Quality dashboard re-runs QA checks on read (same cost profile as the QA
  page); no caching.

## Verification
- reports-test 27 PASS / 0 FAIL / RC=0 (+16 legs): exact quality aggregates
  against seeded placeholder_mismatch + 2x untranslated, branch scoping,
  status totals with exact overdue/due-soon, per-assignee rows, usage
  day/action/total consistency, top-actor attribution, days clamp, non-member
  rejection on all three endpoints.
- e2e-visual 231 PASS / 0 FAIL (+5 legs): progress table, quality summary,
  usage tables with real rows, tasks summary; screenshot
  reports-52-dashboards.png OCR-verified.
- e2e-visual now prints its own E2E_RC=0 success marker in-script, so the
  exit status no longer depends on the outer shell surviving.
- Unit api + web green; both builds clean with real exit codes.
- Interim fixes before commit, both in my own additions: a test fixture that
  never set IN_PROGRESS, and String.replaceAll (es2021) in a template
  targeting es2020 - replaced with split/join.

## Coverage note
Closes the audited "reporting: quality/usage/task dashboards" partial from
the 21 FULL / 8 PARTIAL / 1 MISSING baseline. No other item changes.
