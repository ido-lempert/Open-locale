# 0407 - Screenshot mutation continuation

## Developer review
Per-key shared upload/delete pending guard, selected usable pane/grid required,
known screenshot identity for delete. Capture list generation for count delta, pane
generation for independent refresh. Replaced grid cannot receive stale increment.
Mutation epoch prevents a read begun during a write clearing its later unknown result.
Full successful current list/blob read corrects count and unlocks unknown state.
Confirmed write and refresh failure remain separate. Input resets before awaiting.

## Product review
Pending upload/delete blocks duplicate mutation and key deletion. Closing/switching
pane never cancels submitted request or reopens old pane on completion. Unknown
result uses fixed check-current guidance; explicit full read unlocks, failed read
does not. Unknown state is component-local, not persisted/exactly-once reconciliation.
No translation-grid reload/draft replacement. No auto mutation replay.

## Designer review
Inspected actual desktop pending upload and unknown-write screenshot panes. Pending
explanation, disabled controls, fixed unknown guidance/current-read action and image
remain readable without overlap. Existing screenshot layout retained. No responsive
audit. Current image may remain visible while result unconfirmed, controls blocked.

## Security review
Handler pending/unknown/read-state guards plus disabled controls. Delete requires
selected known screenshot. Fixed feedback does not expose backend errors. Existing
server upload type/size/auth checks unchanged. No API/schema/worker/spend/license or
credential-scope changes. Original upload evidence/live target rechecked before push.

## QA/integration review
New unit18 across duplicate writes, grid replacement/pane change/destroy, fixed
unknown/read failure/full read, epoch race, read-error separate from confirmed write,
unusable-state and unknown-id guards. Initial count-correction change caused one
existing unit failure (573pass/1fail): fixture list was empty despite declared count2;
fixture now contains its two entries, final575/39. API265/31, uncached builds0 initial439.07kB.
Browser6/0 real held POST/DELETE verifies one persisted upload/delete, duplicate
controls, no old-pane reopen, unknown replay blocked and full-current-read recovery.
Initial5PASS1FAIL checked hidden other-pane pending marker before write settled;
wait source-row confirmed count, final6 repeated after epoch fix. Pixels inspected.
Broad API/browser final0, each browser/native stage isolated. SyncSTAGED95+144239unique
and nativeSTAGED116+128244total242unique inner/outer0/checkpoints removed, no interruption.
Not canonical uninterrupted claims. Final sync-config16/native-config10/docs4-138routes/reaper4 all0. Coverage22FULL7PARTIAL
1MISSING/defaultOFF/external acceptance unchanged.
