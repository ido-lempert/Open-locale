# Review 0007 - Import/history data integrity + save ordering

Reviewer-driven hardening of statuses/history before the feature was declared reliable.

## Pass 1 - Developer
- Bulk import now writes per-translation history with BOTH old and new values
  (previousValue added to the schema) and a shared importId per batch - batched lineage,
  not a UI flood. Migration 20261028171000. Single-cell edits also record previousValue.
- Imported wording that differs resets the translation to UNVERIFIED (an imported change
  is unreviewed by definition); identical imports are a true no-op (skipped, no history).
- Import response now reports translationsUpserted, unchangedSkipped and importId.

## Pass 2 - Product manager
- The earlier "imports write no history" limitation is withdrawn: import lineage is now
  recoverable per key (old -> new, actor, batch). The activity log remains the place for
  project-level import summaries (Phase 1).

## Pass 3 - Designer
- History entries from imports render like any other; import badge in the UI deferred
  to the activity-log pass (lineage is in the data and API already).

## Pass 4 - Security researcher
- Import writes run per-key in transactions with the same team scoping as all routes
  (cross-team import already proven 404 in the authz suite).

## Pass 5 - QA / integration
- status-history-test.mjs extended to 14 checks: reviewed->imported-change resets to
  UNVERIFIED; import history keeps old and new values with batch id; import-created key
  has previousValue null; identical re-import is a no-op with no new history. All pass.
- Async ordering: a review chosen while an autosave is in flight can no longer be
  clobbered by the late save response - the client keeps the user's newer review and
  re-sends it after the save lands so the server ends consistent. Deterministic unit
  test (deferred promises, no timing dependency). Web unit 5/5.
- Driver note, honestly recorded: the e2e locale-add step raced the settings reload
  re-render (click/Enter landed mid-patch and were swallowed; reproducible only at
  automation speed). Driver now uses form.requestSubmit(); a human click is unaffected.
  e2e 19/19; authz 28/28; integration 7/7; builds green.

All findings fixed. Clean rerun achieved.
