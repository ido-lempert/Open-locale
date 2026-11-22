# Task deletion confirmation

## Developer
- Task-row Delete now requests a separate confirmation. Confirmation captures the exact loaded row, project ID, project generation, list generation, task ID and title. It clears itself before execution and rechecks each value plus existing row readiness before entering the existing delete lifecycle.
- New list reads, project initialization and destruction clear the confirmation. Existing server API, delete lifecycle and unknown-outcome recovery are unchanged.
- Seventeen new unit cases cover first request, cancel, exact once-only confirmation, stale/blocked rows, changed identifiers/titles, list refresh, project reuse and destruction.
- Initial combined all-project test/build command reached the 120-second execution ceiling after API test/build cache hits and successful web build. Web tests had not completed and that combined attempt is not counted as passed. Standalone web tests passed: 265 suites, 2979 tests, 107.992 seconds. Final all-project test/build check passed with four cache hits.

## Product
- A single click on a row no longer deletes the task. Keep task leaves the task and local new-task form unchanged without a write or list read. Explicit Delete task removes the exact reviewed task once and retains the local form.
- Loaded title and identifiers are shown separately from the new-task form. The explanation does not claim newer server state, current permission, completed deletion or a complete dependency/lock impact preview.
- This is a UI confirmation, not a new server authorization rule or an undo feature. Translation keys and values are not deleted by the existing task deletion operation.

## Designer
- Inspected actual desktop, 390px, long-metadata and post-delete screenshots after the broad sweep.
- Title, IDs, scope limits and both choices are readable on desktop and 390px. Scoped wrapping and maximum height keep long metadata within the modal; scroll remains available for larger content.
- Long markup-like metadata renders as text. The artificial long fixture was canceled before the real delete. No broader keyboard focus-trap or accessibility completion is claimed.

## Security
- Identity uses Angular text interpolation. Long markup-like identifiers created no image element and did not overflow the modal horizontally.
- Stale captured confirmations were rejected after a real list read and after a repeated project visit. Current row identity, generation and existing row guards are rechecked before execution; server permissions remain responsible for authorization.
- Test-only omission of the displayed task ID produced 10 PASS / 1 targeted FAIL and exit 1. The unchanged restored harness passed 11/0. Temporary probe removed. No credential, permission, worker or external-service change.

## QA and integration
- Focused browser first and restored runs passed 11/0. Existing task lifecycle 31/0, receipts 6/0 and unknown-result recovery 10/0 passed after adapting only actual delete choices to confirm explicitly.
- Broad browser sweep: all 267 suites passed on their first attempt, 3366 PASS / 0 FAIL. Each suite ran separately. No application edits or broad-sweep exceptions.
- API legs passed, including tasks 80, sync preview 644, automations 132 and two-factor 37.
- Sync initial first-stage attempt exited 1 before assertions with EEXIST because the checkpoint directory was mistakenly precreated. Removed only the empty directory; unchanged first stage passed 95/0 and second 144/0, total 239.
- Native initial first stage passed 116/0. Initial middle reached 68 PASS then exited 1 as incomplete: its old deletion persistence probe had not made the new confirmation choice. Adapted that probe to confirm explicitly. Because the harness source fingerprint changed, reran native first/middle/tail, passing 116+111+19=246 on PostgreSQL port 56141, each in its own call. These are staged results, not an uninterrupted native run. Earlier results remain in verification history.
- Configuration checks passed 16/14, documentation 4, harness 3 and runner 4. Final documentation, script syntax and whitespace checks passed.
- Feature coverage and external acceptance gaps remain unchanged. Local fixtures do not establish production provider acceptance.
