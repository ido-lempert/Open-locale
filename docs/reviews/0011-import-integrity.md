# Review 0011 - Import run integrity (review-feedback fix)

Scope: recoverable ImportRun rows for every import, atomic counter updates,
per-key failure isolation, non-string leaf rejection, import-runs endpoint,
cursor tie-break proof for activity pagination. Triggered by review feedback:
a crash mid-import previously committed key changes with no audited run record
and no summary, and the 0010 wording overstated the atomicity story.

## Pass 1 - Developer
- The ImportRun row commits BEFORE any key is touched: a crash anywhere leaves
  a durable, audited record of the attempt (status stays RUNNING with counters
  showing exactly what committed - recoverable by reconciliation).
- Each key's change, its TranslationHistory row and the run's counter
  increments commit in ONE transaction: counters on the run row always match
  stored data (proven by reconciling against the export endpoint).
- Terminal status (COMPLETED / PARTIAL / FAILED) and the activity feed summary
  event commit in one final transaction - no summary without status, no status
  without summary.
- Per-key failures are isolated: one bad key no longer aborts the batch; the
  first error is recorded on the run (truncated) and the rest proceed.
- Found while testing: flattenJson silently DROPPED non-string leaves (numbers,
  arrays, nulls) - silent import data loss. Now they are reported as rejected
  key names, counted as failures, and surfaced in the run error.

## Pass 2 - Product manager
- Import responses now say what happened honestly: status, per-category counts,
  and which keys were rejected and why. A re-import of the same file shows
  "unchanged" instead of pretending to rewrite data.
- GET /projects/:id/imports lists recent runs with actor and counts - the
  audit trail a team lead asks for after "who broke the German file".

## Pass 3 - Designer
- No UI change in this pass; the imports endpoint is ready for an import
  history section on the activity page (recorded as a Phase 1 polish item).

## Pass 4 - Security researcher
- Run rows carry actor id and join displayName/email like comments - no new
  data exposure. Cross-team reads of /imports return 404 (proven).
- Error text is truncated and contains key names + driver messages only; no
  file contents beyond what the caller already sent.

## Pass 5 - QA / integration
- import-runs-test.mjs (real PostgreSQL + HTTP): 15/15 - mid-batch failure
  yields PARTIAL with correct counters, counters reconcile with stored data,
  run row predates key data, no run stuck RUNNING after completion, clean
  import COMPLETED, identical re-import skips unchanged, activity summaries
  for all runs with failure counts and run ids, cross-team 404.
- Cursor tie-break proven: 5 events with identical createdAt paginate with
  zero repeats and zero skips (id tiebreaker).
- Full regression: integration 7/7, authz 28/28, statuses 14/14, comments
  18/18, activity 24/24, tags 9/9, e2e 26/26, unit 5+5, builds green.

All findings fixed or recorded with their phase. Clean rerun achieved.
