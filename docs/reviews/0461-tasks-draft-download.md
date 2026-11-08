# 0461 Back up the local new-task form

## Developer review
Separate versioned JSON captures raw current title/description/date and selected
assignee/predecessor/key IDs/lock choice, not loaded-task metadata. Snapshot-bound
feedback disappears when any form field or uncertainty changes. Project visit and
creation start clear prior feedback. Pending creation/no-project/departed handler
refuse backup; list/options pending or failed reads do not block local text.
Existing create/recovery/loaded-metadata behavior unchanged. No API/schema change.

## Product review
Scope and file flags explicitly deny import/create/server-state/selected-ID
verification claims. Unconfirmed creation is retained in file and page; backup
never recovers/retries/submits. Empty form is allowed as backup, not submission
authority. Warns private form text and stale/unavailable IDs; no sharing or saved-
file confirmation. Different buttons distinguish local form from loaded tasks.

## Design review
Final desktop and390px captures inspected: full new-task heading/form, backup
button/scope/request feedback and loaded-task scope readable without horizontal
overflow. First desktop capture was mid-scroll under sticky header; fixture now
scrolls to top before capture. Existing form layout reused, no CSS change.

## Security review
Whitelist excludes loaded tasks/options/emails/extra properties. JSON escapes
literal text without HTML execution. Backup has zero API effects. Uncertain POST
remains uncertain; pending POST and departed handlers cannot export. Temporary URL
released even on click failure; bounded local error excludes exception contents.
No dependency/license/spend/registration/worker/credential-scope change.

## QA/integration review
Unit8/web959 in91 suites/API265 in31, builds0 (cached). Initial plain-shell unit/
build run ended with descendant-cleanup warning, and next build invocation used
unsupported --runInBand; corrected reaped verification all0. New browser11/1 twice
expected newline from existing single-line input and selected raw key ID instead
of Angular option value. Fixture corrected; final12/0 twice, no app correction.
Actual file/zero effects/all fields/held POST/uncertain creation/failed recovery/
reused project/empty/failure/departure covered. All API/88 isolated browsers final0.
Sync95+144=239unique. Native first115/1 missing YAML notice despite yaml selection;
unchanged retry116/0, exact intermittent cause not established. Middle111/tail19
all inner/outer0,246total242unique/four startup repeats. Config16/14/docs4-138routes/
reaper4 all0. Completed checks preserved across continuation; no uninterrupted
claim. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
