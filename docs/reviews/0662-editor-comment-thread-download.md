# Loaded comment-thread download

## Developer
Reviewed the exact loaded key object, loaded project/branch scope and existing comment-readiness guard. Loading, failed reads, unknown writes, replaced keys and departed components cannot create a download. The JSON uses an explicit comment mapping, not the component state. Object URLs are revoked on success and anchor failure. No API route or database change is added.

## Product
This is a local copy of the currently loaded thread, including root comments and replies. It excludes unsent forms, translations and screenshots. The UI explicitly says it is not a restorable backup, complete history, newer server state or proof of a write. The result says download requested, not file saved. Refresh and mutation transitions clear the old notice. Coverage classification and disabled-worker state are unchanged.

## Designer
Inspected actual desktop, 390px mobile and refreshed-result screenshots after the broad suite. The download control, private-content warning and result notice are readable and fit the mobile width. The first pointer download preserves the focused translation and its unsaved value. Existing comment locale, reply target and new-key text remain intact.

## Security
Reviewed the payload boundary: only the current loaded thread identity and stored comments are serialized. The warning names private bodies, IDs, author emails and mention details. A fixed filename and JSON Blob avoid HTML execution or a network destination. No sharing, permission change, credential change or background worker is introduced. Failures use fixed text rather than private exception details.

## QA and integration
- Focused unit suite: 24 tests passed.
- Planned nonoverlapping web-unit stages: 135 files / 1,638 tests, then 135 files / 1,485 tests. Total 270 unique configured files / 3,123 tests. This is staged coverage, not an uninterrupted full-web run or a seeded whole-web cache result.
- Real Angular/Chrome/API/PostgreSQL download suite: 11 checks passed. Actual downloaded file bytes include stored root/reply bodies, IDs, locale, author and mention details while excluding local forms. Real pending and failed thread reads block downloads; explicit retry exports the newly loaded third comment. No API write or grid read is caused by downloading.
- Negative test: removing a stored body from the downloaded file caused the targeted check to fail, 10 pass / 1 fail, exit 1. Temporary mutation removed; restored suite 11 pass / 0 fail.
- Broad browser regression: 272 suites, 3,428 current pass checks / 0 fail checks. 271 suites passed first attempt. Existing comment-delete confirmation suite 074 initially timed out after viewport resize. A temporary click-target diagnostic observed the second click hitting a table cell while readiness remained healthy. Its helper now scrolls the same real button to center, waits two animation frames and clicks. The harness-only fix passed 15 checks; initial timeout and diagnostic history are preserved. No application fix was required.
- API regression legs passed, including sync preview 644, automations 132 and two-factor 37. Sync browser stages passed 95 + 144 = 239. Native visual stages passed 116 + 111 + 19 = 246. Each browser suite and native stage ran separately.
- Final API units: cached 31 suites / 265 tests. Final API/web build: both cached, exit 0. Docs 4, sync-stage config 16, visual-stage config 14, reset harness 3 and runner 4 checks passed. Syntax and diff checks passed.

No external-service acceptance is promoted by these local checks. Docker runtime, external delivery/CDN/host/provider/IdP and production-automation acceptance gaps remain; accepted GitHub two-way remote write/baseline advance remains missing. No worker enablement, spend, registration, token-scope expansion or license choice.
