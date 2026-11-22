# Edit loaded task details

## Developer
Reviewed the exact loaded task object, loaded project scope and the existing row guards. The editor binds the specific row, project, generation and scope; stale rows, unknown writes, failed reads and replaced lists cannot open, save or replay an edit. Save sends only the trimmed title and description; dates, status, assignments, dependencies and locks are never included. A pending save blocks duplicate saves and closes; a failed PATCH keeps the local text and requires an explicit choice; a confirmed write whose list refresh fails stays confirmed without replay. No API route or database change is added.

## Product
This is an explicit title/description edit for one already loaded task. The panel states it is not a fresh permission check or newer server state, and that text is not saved automatically or restored after leaving. Title is limited to 1-200 characters and description to 2,000 using the API count; outer whitespace is trimmed on Save and an empty description clears the stored one. The result says the details were updated, with retry guidance when the list read fails. Coverage classification and disabled-worker state are unchanged.

## Designer
Inspected the actual desktop, 390px mobile, scrolled mobile, updated-result and result-row screenshots after the broad suite. The editor panel, character guidance and Save/Close controls are readable and fit the mobile width without overlap. The title input receives focus on open and the row's Edit details control stays reachable beside the existing status, assignee, due-date and delete controls. Existing rows, the new-task form and download sections render unchanged.

## Security
Reviewed the write boundary: the PATCH carries only the trimmed title and description for the bound loaded task ID, under the existing task authorization. Markup-looking text is stored as plain text and rendered through Angular escaping; no HTML execution path is introduced. No sharing, permission change, credential change, network destination or background worker is introduced. Failures use fixed text rather than private exception details.

## QA and integration
- Focused unit suite: 28 tests passed, confirmed in two runs.
- Planned nonoverlapping web-unit stages: 136 files / 1,646 tests, then 135 files / 1,505 tests. Total 271 unique configured files / 3,151 tests. This is staged coverage, not an uninterrupted full-web run or a seeded whole-web cache result.
- Real Angular/Chrome/API/PostgreSQL edit suite: 14 checks passed. Initial run failed 13 pass / 1 fail on a close-DOM race; a diagnostic observed the editor already removed with zero writes, and the harness now waits for the DOM removal before asserting. Restored 14 pass / 0 fail, re-passed after the accessibility focus change and in the final run. The initial failure, diagnostic and harness-only fix history are preserved; no application fix was required.
- Negative test: dropping the description from the held PATCH caused the targeted check to fail, 13 pass / 1 fail, exit 1. Temporary mutation removed; restored suite 14 pass / 0 fail.
- Broad browser regression: 273 suites, 3,442 current pass checks / 0 fail checks. 272 suites passed first attempt. The existing settings MT-name discard suite initially failed three times when its embedded PostgreSQL could not bind its fixed port; a live probe found no listener holding the port after each failure and a full clean pass of 8 checks on retry, confirming a transient external port hold, not an application regression. Failure and diagnostic history is preserved.
- API regression legs passed, including sync preview 644, automations 132 and two-factor 37. Sync browser stages passed 95 + 144 = 239. Native visual stages passed 116 + 111 + 19 = 246. Each browser suite and native stage ran separately.
- Final API units: cached 31 suites / 265 tests. Final API/web build passed. Docs 4, sync-stage config 16, visual-stage config 14, reset harness 3 and runner 4 checks passed. Syntax and diff checks passed.

No external-service acceptance is promoted by these local checks. Docker runtime, external delivery/CDN/host/provider/IdP and production-automation acceptance gaps remain; accepted GitHub two-way remote write/baseline advance remains missing. No worker enablement, spend, registration, token-scope expansion or license choice.
