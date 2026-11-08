# 0467 Explicit local new-task form discard

## Developer review
Inline confirmation captures exact current project/form JSON/uncertainty. All raw
fields and selected IDs/lock choice cleared only after matching confirmation.
Pending/empty/no-project/departed/stale handlers refuse. Creation/project visit/
departure clears prompt; newer edits hide receipt. No API/storage/navigation.
Independent list/option reads and row work do not block local text discard.

## Product review
Copy/download-first/no-undo warning; Keep retains whole form. Discard is local,
not server task deletion, unassignment or lock removal. Unknown creation and row
state remain unknown; only existing explicit recovery resolves uncertainty. Server
receipts/errors/tasks retained. Empty form never creates permission to replay.

## Design review
Desktop and390px original screenshots inspected: readable inline warning with
spaced Keep/Discard, controls inside viewport, no document overflow. New-task panel
remains distinct from loaded task controls. Existing long single-line description
scrolls inside its input, no claim of showing its full contents at once. No native
modal or automatic blur mutation introduced; no pixel correction needed.

## Security review
Only explicit form fields and current scope reset. No private source export or
external effects. Unknown server effects cannot be concealed by reset. No new
dependency, license, worker, registration, spend or credential-scope change.

## QA/integration review
Unit15/web1004 in97 suites/API265 in31/builds0 (API cached). Dedicated real browser
12/0 exact whole-form/Keep/stale edit/zero effects/held creation/real committed then
lost response/failed-current recovery/reused project/departure. All API/94 isolated
browsers0. Separate sync95+144=239unique; native116+111+19=246total242unique/four
startup repeats, all inner/outer0. No failed/aborted checks this slice. Config16/14/docs4-138routes/reaper4 all0. Completed
results preserved across continuation; staged/no uninterrupted claim. Coverage
22FULL7PARTIAL1MISSING/defaultOFF unchanged.
