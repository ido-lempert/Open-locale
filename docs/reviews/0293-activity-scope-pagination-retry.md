# 0293 - Activity scope, pagination and retry

## Developer review
Reused project route subscription resets filters/cursor/members and cancels pending
key debounce. Generation plus project/destroy guards cover result/error/finally;
member metadata scoped separately. Typing invalidates old reads before debounce.
Load more rejects concurrent requests while loading; failure preserves prior rows
and cursor, explicit retry repeats failed page rather than restarting the feed.
Six unit tests cover stale success/loading/error, page concurrency/retry, project
scope, destroy/debounce and pre-debounce invalidation. No API/query/schema change.

## Product review
Filters/projects cannot display a late previous feed. Pending is distinct from
empty success. Failed older-page read keeps already loaded rows with fixed error;
retry appends remaining actual events once. Actual browser also holds action read,
changes reused project route then releases old response without cross-project feed.
No automatic retry or exactly-once delivery claim.

## Designer review
Fresh480x900 recovered empty-project view inspected: wrapped header/filter controls
fit, no document overflow. Failed-page view preserves prior feed with error/retry
above rows; loading status/main aria-busy and disabled Load more announce pending.
Initial actual retry click timed out under sticky header after immediate scroll;
harness now scrolls centered/instant then settles120ms before real pointer click.
Assertions retained, six checks green. No application fix for that test failure.

## Security review
Fixed nonprivate error text and unchanged read-only endpoint/permissions. Old private
feed/member metadata fenced after project/destroy; debounce cancelled on destroy.
No network-abort/memory-erasure claim, account/scope/spend/license change. Owner
request and todo rechecked. Existing authorization stays server-owned.

## QA/integration review
Web167->173/11 new six-test suite, API265/31, reports118/sync644/syncbrowser239,
QAbrowser9 green. New actualPG55536/Chrome activity6 makes45unique integration/
config legs; completed inner/outer0. Initial activity run2PASS then timeout/1FAIL
at retry click; centered settled pointer-click fix reran6/0. No other failures.
Builds/reaper4/docs4/138routes0. Native STAGED116+128=244total/242unique PG55534
inner/outer0/checkpointremoved, not uninterrupted. No app changes after native; final fixture/capture-only changes afterward;
Final visual found synthetic events lacked normal detail payload, showing undefined;
fixture now supplies previousValue/value and capture scrolls to top before screenshot.
Finalactivity6 rerun0. Bundle570.37kBvs500warning(previous568.85). Docker static
only/no daemon claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged;
no remote/baseline advance/accepted sync/enabledworker. Report snapshot caveats stay.
