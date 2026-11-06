# 0420 Independent report refresh

## Developer review
Three guarded refresh handlers reuse existing fenced reads. Capture selected branch
and usage days at request time; pending/destroy guards suppress duplicate refresh.
Each refresh clears only its report section. Existing project/read generations
suppress stale results. No combined-snapshot or automatic polling claim.

## Product review
Previously successful report reads lacked a normal refresh without navigation or
changing filters. Refresh branch reports, Refresh usage and Refresh task report
now fetch fresh saved figures in place, keeping selection and sibling figures.
Failures retain existing section-specific Retry behavior. Usage/task reports remain
project-wide; branch selector affects progress/quality only. No data writes.

## Design review
Inspected actual reports-refresh full-page pixels after resetting scroll: all three
controls, selected release branch/7-day window and figures readable without overlap.
Initial scrolled capture had sticky-header artifact; recaptured, no app layout fix.
Controls use existing button styling and section placement.

## Security review
Read-only existing authenticated endpoints, no new privilege/account/credential/
worker/provider/schema/license/spend changes. No raw errors added. Original upload
authority/live target checked pre-push; external acceptance unchanged.

## QA/integration review
Unit3 covers selected scope, duplicate/destroy guard and unchanged siblings. API265/31
web702/52 builds0 initial442.18kB. New browser7/0 repeatedly, strengthened exact
sibling assertion: real persisted release key/activity/task created outside current
view, held independent GETs, duplicate handler suppressed, fresh figures/no sibling
reads/filter reset. Actual pixels inspected. All other API/browser suites final0.
Sync staged95+144239unique0. Native first initially13PASS1FAIL then incomplete timeout:
page-text key readiness matched typed form before create completed, second guarded
click was not sent. Fixture now awaits actual key row plus enabled create control.
Fresh native116+111+19246total242unique/four startup repeats every inner/outer0.
No canonical uninterrupted claim or interrupted checks. Final configs16/14 docs4-
138routes/reaper4 all0; checkpoints removed. Coverage22FULL7PARTIAL1MISSING/defaultOFF.
