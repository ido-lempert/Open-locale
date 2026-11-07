# 0430 Activity Clear filters

## Developer review
Reset action/actor/key together, cancel key debounce and use existing reset read.
No current filters/destroyed guard prevents duplicate captured handlers. Existing
generation fences reject late filtered responses. Cursor resets to first page;
member options/errors remain independent. No API/schema/dependency change.

## Product review
One explicit return to current unfiltered project activity. Guidance says first
page, Load more for earlier entries, not complete history or automatic refresh.
Failed Clear keeps cleared scope and bounded retry; no success/outcome claim.

## Design review
Actual desktop/390px pixels inspected. Spacing added between Refresh/Clear;
narrow capture scrolled to top before inspection. Controls/guidance readable
without overlap; existing feed layout retained. Both screenshots transferred.

## Security review
No added account access, writes, provider/worker enablement, spend, license or
credential changes. Uses existing authorized activity read and fixed error.
Late-scope/destroy guards retained. Original owner upload authority and live
repository target/baseline verified before push.

## QA/integration review
Unit5 all-filter single first-page read/member independence/duplicate suppression,
debounce cancel/late response/error retry/destroy. Browser7 twice actual socket
requests, pending debounce oneGET, held filtered response ignored, cleared
controls/page, failed Clear/retry/pagination and zero writes. Initial missing
this. before hasFilters caused5unit failures (742pass/747total) and web build
failure, fixed app then reran both. Spacing/capture fix verified after rerun.
API265/31 web747/62 builds0 initial444.16kB. All API/isolated browser regressions0;
sync separate95/144239unique, native116/111/19 (246total242unique/four repeats),
inner/outer0. Final16/14/docs4-138routes/reaper4 all0. No interrupted check or
canonical uninterrupted claim. Checkpoints removed. Coverage22FULL7PARTIAL1MISSING/
defaultOFF and external acceptance unchanged.
