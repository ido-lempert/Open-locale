# 0431 Loaded snapshot label search

## Developer review
Computed literal trimmed case-insensitive label projection retains complete
loaded array and snapshot object identities. Search cap/destroy fence; project
visit resets query, explicit reread keeps it. Existing restoreReady and
confirmation/current-generation checks unchanged. No API/schema/dependency change.

## Product review
Find loaded snapshot labels with shown/loaded count, distinct no-match and Clear.
Search is local, not a server read or snapshot-state preview. Refresh reads newer
changes. Capture label/receipt and unknown restore pause preserved across hidden
rows. No automatic unlock, restore, or complete-history claim.

## Design review
Actual desktop/390px and no-match screenshots inspected: labeled search/Clear,
count and scope readable without overlap; draft and restore warning stay visible.
Existing responsive row/disabled Restore remain readable. Evidence transferred.

## Security review
No new account reads/writes, provider/worker enablement, spend, license or
credential changes. Existing dangerous restore confirmation and unknown pause
unchanged; hiding/revealing rows cannot clear pause. Original upload authority
and live repository target/baseline checked before push.

## QA/integration review
Unit4 literal/case/trim/object identity, full rows/draft/receipt/pause retained,
no requests, cap/project reset/current reread/destroy. Browser7 actual two-row
fixture, no-match/Clear/no requests, failed restore pause survives hide/reveal,
current reread keeps search and existing recovery semantics. Initial0PASS1FAIL
timeout from inherited import creating third automatic snapshot; removed unrelated
seed import/task, no app fix. API265/31 web751/63 builds0 initial444.16kB. All API/
isolated browser regressions0; sync separate95/144239unique, native116/111/19
(246total242unique/four repeats), inner/outer0. Final16/14/docs4-138routes/reaper4
all0. No interrupted test/canonical uninterrupted claim. A documentation write
was cut off before taking effect, confirmed absent twice then rewritten; completed
checks preserved. Checkpoints removed. Coverage22FULL7PARTIAL1MISSING/defaultOFF
and external acceptance unchanged.
