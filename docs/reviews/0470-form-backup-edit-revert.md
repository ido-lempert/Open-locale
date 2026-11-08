# 0470 Clear obsolete local form backup notices on edit

## Developer review
Snapshot equality alone let an old download result return after editing and
exactly reverting the project/task form. Existing user-edit handlers now also
clear draftDownloadResult. Exact snapshot checks remain. No backup schema, API,
creation, recovery or persistence change. All ten form fields/choices covered.

## Product review
A prior requested or failed backup notice no longer describes a subsequently
edited form, even if its bytes return to the original value. A fresh explicit
download restores current feedback. Download remains a local request, not proof
of saving/sharing, server creation or restoration. Unknown outcomes unchanged.

## Design review
Inspected desktop and 390px screenshots: readable current task backup notice,
full form and scope text, no horizontal overflow. No layout changes. Project
security inputs remain independent and do not clear valid project form feedback.

## Security review
Only local notice invalidation added. Existing JSON whitelists and generic failure
messages retained; security inputs excluded. No new dependency, destination,
request, storage, worker, registration, spend, credential scope or license change.

## QA/integration review
Five new units; web1027 in100 suites/API265 in31 and both builds exit0 (API cached).
New real browser17/0: all ten DOM inputs/choices edit+exact revert, actual JSON,
no duplicate download/API effects, both failed notices nonrevival, fresh explicit
backup and security independence. All API suites and97 isolated browsers final0.
Existing QA-search first5PASS then line44 clear-search wait timeout; unchanged
retry10/0. Exact cause unestablished, no app/test fix; initial full log retained.
Separate sync95+144=239unique; native116+111+19=246total/242unique/four startup
repeats, all inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Completed
checks preserved across continuation; staged verification, no uninterrupted claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
