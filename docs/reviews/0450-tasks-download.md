# 0450 Download loaded task metadata

## Developer review
Explicit projection of all loaded tasks under assignee/status filters, ignoring
local search. Initial, pending read, failed read, pending mutation, unknown row or
create outcome and destroyed guards cover button and captured download handler.
Read/mutation start clears readiness and old notice; current fetch completion
restores loaded state but unknown/pending guards remain independent. Temporary
Blob URL released even if click fails. No API/schema/dependency change.

## Product review
Metadata download is a local review aid, not complete project history/newer server
state or confirmation of task outcomes. Includes IDs, titles, status/due date,
displayed assignee/group name, predecessor ID and lock/key metadata. Excludes
full descriptions and creator details; can still contain private metadata.
Requested does not mean saved/shared. No automatic reads/writes or sharing.

## Design review
Actual desktop/390px pixels inspected: button, scope and requested notice readable
without horizontal overflow; full-loaded vs local-search difference explicit.
Existing form/rows remain unchanged. No visual correction required.

## Security review
Whitelist excludes descriptions, emails, creator details and unknown API fields,
including nested key fields. JSON escapes literal quotes/newlines/markup rather
than executable spreadsheet/HTML. Uncertain mutations cannot export apparent
fresh state. No external/worker/account/spend/credential-scope changes. Original
owner upload scope checked before push with exact live repository/remote state.

## QA/integration review
New unit10/web865 in80 suites/API265 in31/builds0. Real browser11/0 first run:
exact downloaded bytes despite local search/newer unread task, sensitive-field
exclusion, held/failed reads, real uncertain row mutation/export pause, current
recovery, empty new project, bounded local failure and departed handler. Local
download has zero API effects. All API/77 isolated browser suites0, no failed or
interrupted checks. Separate sync95+144=239unique and native116+111+19=246total
242unique/four startup repeats, inner/outer0. Config16/14/docs4-138routes/reaper4
all0. Slower runtime continued across runs with completed results preserved;
no canonical uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
