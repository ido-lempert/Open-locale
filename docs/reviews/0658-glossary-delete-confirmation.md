# Glossary deletion confirmation

## Developer
- Row Delete now requests a separate confirmation. It captures the exact loaded row, project ID, project and list generations, term ID, term name and serialized local translation text. Confirmation clears itself and rechecks the captured values and existing row readiness before entering the unchanged delete lifecycle.
- List reads, project initialization, destruction and local translation edits clear the confirmation. No API or server permission change.
- Twenty new unit cases cover first request, cancel, exact once-only confirmation, blocked and replaced rows, identifier/name/text changes, refresh, repeated project visits and destruction.
- Actual web unit run passed 266 suites and 2999 tests in 106.221 seconds. API/web build passed; later all-project test/build check used four cache hits.

## Product
- One click no longer deletes a glossary term. Keep term preserves the term, focused local translation text and local new-term form without a read, delete or blur-save in the tested pointer flow.
- The warning names stored glossary translations and loss of unsaved text for the deleted term. It advises copying/downloading first and makes no undo promise.
- Loaded identity is explicitly not a fresh permission check, newer server state or completed deletion. Other term drafts and the new-term form are outside this deletion.
- Explicit confirmation deletes only the exact reviewed term once. Other local translations and the new-term form remain, without a completion reload.

## Designer
- Inspected actual desktop, 390px, long-metadata and post-delete screenshots after the broad sweep.
- Warning, IDs, term name and both choices are readable on desktop and 390px. Long markup-like text wraps within the modal. Maximum height and vertical scrolling bound larger content.
- The artificial long fixture was canceled before the real delete. No keyboard focus-trap or complete accessibility claim. Keyboard navigation may cause the existing translation blur-save before a delete choice; pointer opening/cancel/confirm prevent that blur in the tested flow.

## Security
- Identity uses Angular text interpolation. Long markup-like values produced text, not an image element, and no horizontal modal overflow.
- Stale captured confirmation was rejected after a real list read and after a repeated project visit. Exact current row, local text, generations and existing pending/unknown-result guards are rechecked before deletion. Server permissions still authorize the request.
- Test-only omission of the displayed term ID caused 11 PASS / 1 targeted FAIL and exit 1. Restoring the unchanged harness passed 12/0; the temporary probe was removed.
- No credential, permission, worker or external-service change.

## QA and integration
- Focused browser first and restored runs passed 12/0. Real pointer opening/cancel retained focus and edited translation text with no PATCH, DELETE or GET; persisted text remained unchanged. Real confirmation deleted the exact term once without blur-saving discarded text.
- Existing glossary lifecycle 38/0, local-delete 6/0 and attention 13/0 passed first attempt after adapting actual delete choices to confirm explicitly.
- Broad sweep: 268/268 suites currently pass, 3378 PASS / 0 FAIL. Each suite ran separately. 267 passed first attempt. Suite 096 initially aborted before app assertions because PostgreSQL port 55728 could not bind; the observed socket was a TIME_WAIT connection to web port 4200, not a listener. Preserved that aborted run, waited 45 seconds, then the unchanged same-port retry passed 12/0. No other broad exception or app edit during the sweep.
- API legs passed first attempt, including glossary 15, tasks 80, sync preview 644, automations 132 and two-factor 37.
- Sync stages passed first attempt, 95+144=239. Native stages passed first attempt, 116+111+19=246 on PostgreSQL port 56143. Each native stage ran in its own call; these are staged results, not an uninterrupted native run. No staging exception in this slice.
- Configuration checks passed 16/14, documentation 4, harness 3 and runner 4. Final cached test/build, documentation, script syntax and whitespace checks are recorded in the closeout evidence.
- Coverage remains 22 FULL / 7 PARTIAL / 1 MISSING with workers off. Local fixtures do not establish external acceptance or production provider readiness.
