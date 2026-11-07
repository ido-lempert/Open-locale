# 0428 Loaded branch reports download

## Developer review
Synchronous JSON capture of loaded progress/quality and project/branch scope.
Handler guards pending/error/missing/destroy; branch read clears prior download
feedback. Temporary object URL cleaned in finally, fixed safe filename. Existing
independent dashboards and report generation fences unchanged.

## Product review
Offline branch report review without fresh account reads. Explicitly excludes
usage/tasks and newer server/live draft state, and disclaims one shared database
snapshot. Successful empty reports can download. Private local-file guidance and
requested-not-saved/shared feedback. No delivery/export history or snapshot claim.

## Design review
Actual full-page release report screenshot inspected: download beside independent
Refresh, privacy/loaded-only/separate-read guidance readable, figures and sibling
dashboards remain without overlap. Existing table scrolling/layout unchanged.

## Security review
JSON serialization as data, no markup/CSV execution. No API/privilege/schema/worker/
provider/account/credential/license/spend changes or external sharing. Existing
report authorization defines contents. Original owner upload scope/live target
checked before push.

## QA/integration review
Unit8 exact branch/sibling exclusion, pending/error/missing/destroy guards, URL
cleanup, fixed failure and branch reread feedback reset. API265/31 web738/60 builds0
initial444.16kB. Browser6/0 actual saved bytes equal release progress/quality, no
account requests/writes, held refresh/captured handler blocked/siblings retained,
failed read blocked, empty main/current scope. Initial5PASS1FAIL nonexistent sibling
.usage-report selector corrected to actual .usage-table, no app fix. All API/isolated
browsers final0; sync staged95/144239unique; native separate116/111/19 (246total242unique/
four repeats), inner/outer0. Final16/14/docs4-138routes/reaper4 all0. No interrupted
checks/canonical uninterrupted claim. Checkpoints removed.22FULL7PARTIAL1MISSING/
defaultOFF/external acceptance unchanged.
