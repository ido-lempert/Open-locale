# 0310 - Explicit Tasks refresh

## Developer review
Refresh uses existing list loader and pending guard; selected status/mine and form
draft remain untouched. Two units cover filters/draft/metadata independence and
pending/destroy suppression. No API/query/schema change.

## Product review
Users can reread tasks without navigating or changing filters. Real task renamed
through API after page load appears on refresh. Unsaved title remains. No polling,
metadata refresh, mutation retry or lifecycle guarantee added.

## Designer review
Fresh480x900 refresh capture inspected after final browser rerun: draft title,
selected OPEN filter, refresh button and updated row fit/readable. Existing form
unchanged; refresh placed just above task list.

## Security review
Existing authorized readonly loader only. Real pointer duplicate while held yields
one request and no member/group/key reload. No credential scope/spend/license or
external provider request. Local fixture mutations only. Owner authority recovered.

## QA/integration review
API265/31/web202->204/12 uncached0/builds0. Tasksbrowser9->11 heldrefresh/draft/
duplicate and actual task update visibility; tasks80/Activity22/reports118/sync644/
syncbrowser239/QA14 unchanged.46uniqueintegration/configlegs inner/outer0; reaper4/
docs4/138routes0. No failures/timeouts/interruption. Native STAGED116+128=244total/
242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted. No app/test edits
after native. Bundle575.39kBvs500warning(previous575.00). Docker static only/no daemon
claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no remote/baselineadvance/
accepted sync/enabledworker. Existing report snapshot/window caveats unchanged.
