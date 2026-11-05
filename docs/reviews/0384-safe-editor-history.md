# 0384 - Safe editor history reads

## Developer review
Generation/key fences cover success/error/finally. Closing resets pane; reopening
same key gets a new generation. Reload clears selection before list reads, so a
branch/filter/load change cannot retain an open old pane. Destroy invalidates and
clears debounce timer. Requests still finish server-side; no cancellation claim.
All-locale Promise.all preserves existing all-or-nothing latest50 display. No API
or model change. Existing editor-wide list/save races and snapshot-only project
route initialization remain outside this bounded change.

## Product review
A failed history read previously became "No changes recorded yet" plus a raw
error on the global editor. Now a fixed inline failure with explicit retry, no
history bytes/empty success until a successful read. Retry reads only current key;
no writes/automatic retry. History remains per-key/locales, not live audit feed.
Reload closes pane deliberately; user can reopen after changed list/branch.

## Designer review
Preserved editor table and typography. Inline red error sentence and retry button
sit directly below selected key. Loading is status, failure is alert, button type
explicit. Actual desktop error and recovered persisted-history pixels inspected,
readable/no clipping in pane. This is not a full mobile/table redesign or a claim
of complete accessibility audit. Existing wide grid remains as before.

## Security review
Fixed error never echoes exception. Clear stale entries on close/read/reload;
late selected-key/destroy success or rejection cannot write pane. Existing text
interpolation/history authorization unchanged. Test-only held response bodies,
isolated disposable PostgreSQL/API/browser; no external connection, worker,
spend/license/credential change. Original owner's named-repository upload scope
recovered verbatim before publication.

## QA/integration review
New6 unit cases (two old success/error variants) cover overlapping keys, same-key
reopen, fixed error/retry, reload, mismatched retry/destroy. API265/31 web346/18
uncached, builds0; initial408.03kB below unchanged500budget. History browser9 final
PASS inner/outer0: held A->B, fresh B, close visible/pending, fixed error, actual
persisted-history retry, route-away, read-only requests/no runtime errors.
Initial8PASS/1FAIL: fixture tested retry before settled rendered list, seeded
persisted history and waited for list instead. No app change for this test fix.
All53 bounded integration/config legs final0 (52 existing plus history browser),
docs4/138routes, staged-sync config16, reaper4. Each browser/native stage isolated.
Sync STAGED95+144=239unique, native STAGED116+128=244total242unique all inner/outer0;
not canonical uninterrupted runs. Checkpoints removed. No app/test change after
final native stages. Docker static-only, external sync/IdP/provider/CDN acceptance
and coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
