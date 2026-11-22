# Translation-key deletion confirmation

## Developer
- Key-row Delete requests a separate confirmation capturing the exact loaded row, project ID, branch, project/grid generations, key ID/name and serialized selected cell state. Confirmation clears itself, rechecks every captured value and existing row readiness, then enters the unchanged delete lifecycle.
- Project/grid reads, searches, local value/plural edits and destruction clear the confirmation. Loaded grid project/branch and exact row are required. No API change.
- Thirty-three new unit cases cover first request, cancel, once-only confirmation, pending/unknown states, row replacement, changed identity/cells, real read, branch away/back and destruction.
- Actual initial web unit run passed 267 suites and 3032 tests in 103.445 seconds. API/web build passed. A later all-project test/build run repeated web tests because its flags differed from the initial cache key, and completed successfully with three other cache hits.

## Product
- One row click no longer deletes a translation key. Keep key preserves both keys, unrelated local translations and the local new-key form without a read, delete or blur-save in the tested pointer flow.
- The warning matches the existing API and schema: stored locale translations and history, comments, screenshot records and linked task-key records are deleted. It offers no key undo and advises copying/downloading needed information first.
- Loaded identity is not presented as a fresh permission check, newer server state, completed deletion or complete impact preview.
- Explicit confirmation deletes the exact key once, without a completion reload or loss of unrelated local translations and the new-key form.

## Designer
- Inspected actual desktop, 390px, long escaped identity and post-delete screenshots after the broad sweep.
- Warning, project/branch/key identity and both choices are readable at desktop and 390px. Long metadata wraps within the modal; maximum height and vertical scrolling bound larger content.
- Artificial long metadata was canceled before the real delete. No complete keyboard focus-trap or accessibility claim. Keyboard navigation may still cause the existing unrelated translation blur-save before a choice; pointer opening/cancel/confirm prevent that blur in the tested flow.

## Security
- Angular text interpolation escapes identity. Long markup-like metadata created text, not an image element, without horizontal modal overflow.
- A real grid read and branch away/back both invalidated a restored old capture. Current selected cell state, exact row, identity, generations and existing dirty/pending/unknown-result guards are rechecked before deletion. Existing server locale permissions, project lock and task edit checks remain unchanged.
- A test-only omission of the displayed key ID caused 11 PASS / 1 targeted FAIL and exit 1. Restored harness passed 12/0. Temporary probe removed.
- No credential, permission, worker or external-service change.

## QA and integration
- Focused browser first/restored runs passed 12/0. Pointer opening/cancel kept a focused unrelated local translation with no PUT, DELETE or GET and unchanged persisted text. Explicit confirmation deleted the selected key once while retaining the other local value and new-key form without a completion read.
- Existing deletion lifecycle 4/0 and committed/lost recovery 8/0 passed first attempt. Their actual deletion choices now confirm explicitly. The older held-save fixture explicitly blurs before asking to delete, preserving its pending unrelated save scenario; the new suite separately proves no blur-save on pointer opening/cancel.
- Broad sweep: all 269 suites passed on their first attempt, 3390 PASS / 0 FAIL. Every suite ran separately. No broad exceptions or app edits during the sweep.
- API legs passed first attempt, including tasks 80, sync preview 644, automations 132 and two-factor 37.
- Sync stages passed first attempt, 95+144=239. Native stages passed first attempt, 116+111+19=246 on PostgreSQL port 56145. Each native stage ran separately; these are staged results, not an uninterrupted run.
- One orchestration interruption: a combined all-project test/build plus later configuration call hit its execution ceiling. Inspection confirmed successful all-project test/build output; documentation output existed, but later configuration and setup were unverified. Reran documentation/configuration/harness/runner/setup separately, all passed. The whole interrupted batch is not counted as passed.
- Documentation 4, stage configuration 16/14, harness 3 and runner 4 passed, with final cached test/build, documentation, script syntax and whitespace checks recorded in closeout evidence.
- Coverage remains 22 FULL / 7 PARTIAL / 1 MISSING, workers off. Local fixtures do not establish external acceptance or production provider readiness.
