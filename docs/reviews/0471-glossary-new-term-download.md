# 0471 Independent local new-term form backup

## Developer review
Separate whitelist JSON contains raw term/notes/do-not-translate, project ID and
explicit creation uncertainty. No loaded terms/row translations. Independent of
list/locale reads and row mutations; pending create/no-project/departed guards.
Snapshot feedback plus user-edit invalidation, reset/create/project lifecycle
clearing. Existing combined glossary draft backup unchanged.

## Product review
Failed glossary reads and row saves no longer prevent backing up the independent
new-term form. Scope says local reference only, no import/create/retry/confirmation
or automatic saving/sharing. Unconfirmed add stays unconfirmed. Empty form backup
is valid and grants no add authority. Current newer form survives confirmed add.

## Design review
Desktop/390px screenshots inspected: readable form backup, scope and current
feedback alongside failed-read and uncertain-add warnings. Combined loaded draft
backup remains disabled. No overflow. Pointerdown prevention keeps an edited row
focused during actual pointer download, avoiding blur autosave.

## Security review
Explicit whitelist excludes loaded private term/translation contents. Generic
local errors, URL cleanup, no new request/storage/destination/dependency/license,
worker, registration, spend or credential scope. Unknown creation remains unknown.

## QA/integration review
Nine units/web1036 in101 suites/API265 in31/both builds0 (API cached). New browser
15/0 verifies actual JSON/raw values/private row exclusion/zero effects, focused
changed-row pointer download, held PATCH independence, held create refusal,
committed-then-lost create, failed read, newer form, failure/edit-revert, reused
project, departure and390px. First fixture4PASS/2FAIL used PUT instead of PATCH and
aborted; second14PASS/1FAIL sampled disabled combined button before render. Fixed
fixture method/wait, no app fix; full initial logs retained.
All API/98 isolated browsers final0; no existing regression failures this slice.
Separate sync95+144=239unique; native116+111+19=246total/242unique/four startup
repeats all inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Completed checks
preserved across continuation; staged, no uninterrupted claim. Coverage22FULL/
7PARTIAL/1MISSING and defaultOFF unchanged.
