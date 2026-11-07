# 0429 Loaded QA type filter

## Developer review
Computed projection keeps complete finding array unchanged. Exact known-type
allowlist and destroy guard; new project visits reset type, explicit rereads keep
it. No API shape, dependencies, database or mutation changes. Existing read and
download guards remain unchanged. All six supported issue types available.

## Product review
Focus loaded findings by issue type, count/no-match/Clear. Branch/locale scope
unchanged. Filtering is local and does not run checks again. JSON intentionally
includes all loaded findings even when no rows match; scope guidance explicitly
says so. No filtering persistence/server search/newer-data claim.

## Design review
Inspected actual desktop and 390px screenshots. Labeled native selector, Clear
button, shown/loaded status and no-match guidance readable, no overlap. Narrow
existing table remains horizontally scrollable. Download scope/privacy text stays
visible. No saved/share claim added.

## Security review
Allowlisted type string, Angular text interpolation, no new network reads/writes,
external disclosure, provider/account/credential/license/spend/worker changes.
Local JSON still includes all loaded private findings, explicitly disclosed.
Original owner upload authority and live repository target checked before push.

## QA/integration review
Unit4 exact filtering/no requests/complete array retained/branch-locale retained,
invalid type/no-match/reread/project reset/destroy. Real browser7/0 release/he,
match/no-match/Clear, actual saved bytes retain full findings when zero shown,
filter/download no requests, explicit reread keeps type. API265/31 web742/61,
builds0 initial444.16kB. All API and isolated browser regressions0. Separate sync
stages95/144 (239unique), native116/111/19 (246total242unique/four repeats), all
inner/outer0. Final config16/14/docs4-138routes/reaper4 all0. No failed or interrupted
checks; no canonical uninterrupted claim. Checkpoints removed. Coverage22FULL/
7PARTIAL/1MISSING/defaultOFF and external acceptance unchanged.
