# 0462 Explain local new-task draft state

## Developer review
Computed presence includes exact raw title/description/date and every selected
assignee/predecessor/key/lock field, including whitespace and stale IDs. No
persistence/request/mutation/reset added. Existing form clearing after confirmed
create and project visit naturally removes draft feedback. Backup and receipts
unchanged. Pending state takes precedence over uncertain state; no API/schema.

## Product review
Normal feedback says local form is not automatically saved/restored and points
to backup, not a server save. Pending creation says current editable form may
differ from submitted task and forbids repeat submission. Uncertain creation
stays unconfirmed, with check-before-create guidance. Download never clears local
feedback or implies creation; row/list failures do not change local form scope.

## Design review
Desktop and390px screenshots inspected: draft feedback directly above form,
backup scope below, all text/controls readable with no document horizontal
overflow. Existing layout reused; no CSS change or pixel correction needed.
Status text changes by state rather than repeating a false unsaved-task claim.

## Security review
Read-only computed presentation uses no HTML interpretation, requests, storage,
external services or credentials. No new navigation trap or auto-submit. Existing
pending/unknown/departed create/backup guards unchanged. No dependency/license,
registration/spend/worker enablement/credential-scope change.

## QA/integration review
Unit4/web963 in92 suites/API265 in31/builds0 (unchanged API cached). New real
browser17/0 covers empty/entered/current file/zero effects/390px/edit/pending
POST/uncertain failure/failed recovery/reused project/confirmed actual creation
clearing unchanged form/failure/departure. All API groups and89 isolated browser
suites final0. Separate sync95+144=239unique/native116+111+19=246total242unique/
four startup repeats, all inner/outer0. Config16/14/docs4-138routes/reaper4 all0.
No failures this slice. Completed checks preserved across continuation; explicitly
staged, no uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
