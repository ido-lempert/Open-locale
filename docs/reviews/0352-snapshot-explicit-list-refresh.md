# 0352 - Explicit snapshot list refresh

## Developer review
Refresh delegates only to existing reload; method and disabled binding reject list
loading/capture/restore. Reload still fences project visits/destruction and clears
stale rows. Mutation feedback and draft are untouched. Existing internal reload is
not blocked, so capture/restore follow-up reads remain valid. Four units cover
preservation plus three pending flags. No app/test edits after native stages.

## Product review
Successful list now has an explicit read-only refresh. People can check snapshots
after an uncertain operation without submitting it again or reloading away draft.
Failure retains existing retry guidance. No automatic reconciliation, mutation retry,
server locking, cancellation, or cross-tab exclusion claim. A refresh is a new read,
not evidence that another still-pending server operation cannot later complete.

## Designer review
Inspected actual480x915 full-page pixels: separate named Refresh snapshots button,
retained draft, latest automatic snapshot, readable rows without page overflow.
No broad responsive claim. Browser held-GET check confirms disabled refresh and
hidden stale rows while loading. Existing failure retry remains distinct.

## Security review
Only authenticated list read added, no extra mutation or new authorization boundary.
Actual browser interception counts zero snapshotPOST. No new account/provider/scope/
disclosure/spend/license/registration. Original owner upload recovered verbatim and
live repository/push/main checked before publication.

## QA/integration review
API265/31/web298->302/14 uncached0/builds0. Snapshotbrowser25->27 actual refresh
click heldGET: one read/duplicate click suppressed/noPOST/stale rows hidden/draft
retained; release reveals automatic snapshot created by prior old restore while
preserving current draft and no stale feedback. Four added method tests.
49unique bounded integration/config legs all inner/outer0 incl docs4/138routes,
config16/reaper4. No286 failures/timeouts/interruption. Each browser/native stage
isolated. Syncbrowser STAGED95+144=239unique both0/checkpointremoved, not canonical
uninterrupted. Native STAGED116+128=244total/242unique both0/checkpointremoved, not
uninterrupted. No app/test changes after verified stages.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle585.93kBvs500warning (prior585.46kB).
