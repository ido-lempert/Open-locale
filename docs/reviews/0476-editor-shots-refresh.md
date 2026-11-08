# 0476 Refresh open screenshot pane

## Developer review
Healthy-pane explicit refresh uses existing selected-key list/image reader and
blob ownership cleanup. Ready guard includes current loaded key, settled healthy
pane, key state, no pending or uncertain screenshot change and not departed.
Duplicate captured calls refused. Closing or moving panes invalidates old reads.
No editor reload, translation cell reset, API or mutation behavior change.

## Product review
New stored context images can be read while retaining local translation work.
Scope says list/image bytes only, separate reads not one database snapshot.
Failures keep existing fixed retry route; uncertain changes keep dedicated
Check current screenshots route. Pending changes are not canceled by closing.

## Design review
Actual desktop/390px screenshots inspected: refresh, wrapped scope, image list
and local draft remain readable. Pointer mousedown prevents translation blur
from causing autosave when refreshing. Mobile translation input stays readable.
No new destructive action, confirmation or implied automatic refresh.

## Security review
Read-only action, no new endpoint/storage/dependency/license/registration/spend,
worker or credential changes. Existing authenticated image route and URL
revocation remain. Captured handler cannot bypass pending/uncertain/departed
checks. Fixed error hides backend details; no permission expansion.

## QA/integration review
13 units/web1075 in106 suites/API265 in31/both builds0 (API cached). Initial
unit fixture used nonexistent values field, corrected actual cell model then0.
New real browser first9PASS1FAIL sampled pending DOM before render; fixture wait
added then10/0, same app.10/0 in full sweep. Real new stored image, actual focused
pointer refresh zero mutations, screenshot-only list+two images reads, duplicate
refusal, old blob revocation, draft retention, failure/retry, uncertainty route,
close-during-read cleanup and390px covered. Initial full log retained.
All API/103 isolated browsers final0. Existing activity-download first1PASS then
line45 missing notice abort, unchanged11/0 retry/exact cause unestablished/no
app-test fix/full initial log retained. Existing tasks-draft-download preassertion
socket bind abort0PASS, unchanged delayed12/0/no app-test fix/full log retained.
Separate sync95+144=239unique; native116+111+19=246total/242unique/four startup
repeats, all inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Completed
checks preserved across continuation; staged/no uninterrupted claim. Coverage
22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
