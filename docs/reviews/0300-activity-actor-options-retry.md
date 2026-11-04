# 0300 - Activity actor options retry

## Developer review
Actor discovery moved into an independent loader with request/project/destroy
fences. Only current responses settle loading/options/error. Project reuse clears
old options; failed metadata no longer silently masquerades as an empty list.
Five units cover independent retry, preserved feed/filter/cursor, old failure,
old success, project reuse and destroy. No API/query/schema change.

## Product review
Fixed failure explains that activity remains available; explicit retry requests
only member metadata. Actual browser verifies no feed reread/replacement while
retry is held and after real API member options recover. This does not add former
users to the current member filter or promise complete historical actor coverage.

## Designer review
Fresh480x900 viewport captures inspected for error/loading/recovered states.
Actor/key/action controls fit; status, retry and feed readable, no new overflow.
Initial full-page evidence was too tall for useful review; switched those three
captures to viewport screenshots, reran and inspected. Application layout unchanged.

## Security review
Fixed error omits raw metadata error details. Existing member authorization and
text rendering untouched. Stale metadata cannot enter another project's options.
Local fixtures only; no new secrets/account scope/spend/license/provider action.
Owner original/todo recovered from trusted conversation evidence this slice.

## QA/integration review
API265/31, web182->187/11 uncached0; builds0. Activity11->14 actual browser checks0;
reports118/sync644/syncbrowser239/QA14 unchanged.45uniqueintegration/configlegs
including docs completed inner/outer0; reaper4/0; docs4/138routes0.
Native STAGED116+128=244total/242unique PG55534 inner/outer0, checkpointremoved,
not uninterrupted. No app/test edits after native. Bundle573.12kBvs500warning
(previous572.21). Docker static only/no daemon execution claim. Coverage22FULL/
7PARTIAL/1MISSING/defaultOFF unchanged; no remote/baseline advance/accepted sync/
enabledworker. Existing report snapshot/window caveats unchanged.

Failure chronology: first unreaped browser/build call had inner test/build0 but
outer cleanup1 for detached descendants; reaped Activity14 reruns outer0. Combined
reports/sync/browser120s interrupted syncbrowser after reports118/sync644 inner0,
no FAIL. Own Nx5358/Chrome5415+crashhandlers stopped; PG5295 zombie/TCP55479closed.
First isolated retry hit leftover socket lock (startup FAIL, innerexit0 caught by
batch1); verified zombie/closedport, removed test socket/lock, isolated239 outer0.
Combined webhooks/MT/automation120s interrupted automation after webhooks45/MT55
inner0, no FAIL before interruption. PG6455 zombie/TCP55470closed; removed stale
test socket/lock, isolatedautomation132 inner/outer0. No external writes affected.
