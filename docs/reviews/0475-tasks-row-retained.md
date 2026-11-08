# 0475 Loaded task row retained selections

## Developer review
Missing row member/group options retain exact selected loaded assignment ID.
Missing predecessor in current task list retains selected loaded predecessor ID.
Group namespace respected; present options avoid duplication; self predecessor
not offered as ordinary current option. Row update payloads, guards and API
unchanged. Local title search does not decide predecessor option membership.

## Product review
Fixes misleading blank assignment/predecessor controls after omitted independent
options or server task filtering. Loaded selection is not current availability
or permission verification. Explicit warning says refresh/retry to check newer
state; nothing is silently cleared. Explicit unassign/clear still uses ordinary
server-validated mutation. New-task form and download scopes unchanged.

## Design review
Desktop/390px pixels inspected. Initial predecessor fallback clipped; shortened
to Loaded predecessor, kept outside-options explanation in wrapping row notice.
Rebuilt/retested/recaptured final desktop and mobile. Selected assignee and
predecessor labels readable; document does not overflow. Warnings do not obscure
ordinary controls or imply an empty option list proves no assignment.

## Security review
No new reads/storage/dependencies/license/registration/worker/spend/credential
changes. Generic fallback labels do not invent names or current membership.
No permission bypass or enablement of paused row actions. Existing row and
server validation remain authoritative; warnings use ordinary escaped template.

## QA/integration review
Six units/web1062 in105 suites/API265 in31/both builds0 (API cached). Initial
unit fixture expected null member ID in group patch; existing semantics only
send group ID. Corrected fixture, full rerun0. New real browser11/0 initially,
then12/0 after design fix/additional persisted predecessor-clear check;12/0 in
sweep. Actual member/group assignments, DONE predecessor omitted by server OPEN
filter, local search zero effects, failed/empty/current options, no duplicates,
real persisted explicit unassign and predecessor clear, paused row guards,
project reset and390px. All API/102 isolated browsers final0. Existing report
locale search twice aborted before assertions (0PASS), PostgreSQL55754 socket
bind failure; unchanged delayed11/0, both full logs preserved/no app-test fix.
Separate sync95+144=239unique; native116+111+19=246total/242unique/four startup
repeats, all inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Completed
checks preserved across continuation; staged/no uninterrupted claim. Coverage
22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
