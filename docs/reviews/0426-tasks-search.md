# 0426 Loaded task search

## Developer review
Computed visibleTasks filters only rendered rows, leaving the full tasks signal
for dependency choices, row readiness and mutation handling. Local capped query
has destroy guard/project reset. Explicit Read all tasks recovery clears query
alongside server filters; existing current-read/epoch requirements stay unchanged.

## Product review
Find loaded task titles/descriptions with literal case-insensitive substring,
count/no-match/Clear. Scope explicitly within current server assignee/status filters.
Search does not refetch, replace form, clear unknown-action pause or replay changes.
Explicit recovery clears search so recovered rows are visible. No server search,
polling, persistence or outcome reconciliation claim. New tasks may be hidden by search.

## Design review
First pixels had Refresh/search label on one cramped inline row. Separated search
into a spaced block, rebuilt/retested and reinspected actual screenshot: readable
label/count/filtered row, retained form and paused-action guidance, no overlap.
Existing task row wrapping unchanged.

## Security review
No API/privilege/schema/worker/provider/account/credential/license/spend changes.
Literal includes, query capped200; Angular text rendering. Browser proves no search
GETs or writes and unknown-action controls stay disabled. Original owner upload
scope and live target checked before push.

## QA/integration review
Unit4 literal/case/title/description/full-list identity; form/selections/receipts/
server filters/unknown pause retention/no requests; explicit recovery clears local
search; cap/destroy. API265/31 web724/58 builds0 initial444.16kB. Browser7/0 before
and after layout fix: real description/title/no-match/Clear, full dependency choices,
form/filter retention, actual failed PATCH pause survives search, explicit recovery
oneGET/no replay and search/filter clear. All API/isolated browsers0; sync staged
95/144239unique; native separate116/111/19 (246total242unique/four repeats), all inner/
outer0. Final config16/14/docs4-138routes/reaper4 all0. No failed/interrupted checks
or uninterrupted canonical claim. Checkpoints removed.22FULL7PARTIAL1MISSING/
defaultOFF/external acceptance unchanged.
