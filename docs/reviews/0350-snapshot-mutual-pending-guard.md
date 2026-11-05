# 0350 - Snapshot capture/restore mutual pending guard

## Developer review
Both entry methods reject the opposite pending operation; both button bindings use
both flags. Flags remain set through the operation's follow-up list read and clear
only for the current visit. Existing visit/destruction fencing is unchanged.
Two method tests verify rejection before confirmation/submission and later admission.
No app/test changes after native stages.

## Product review
Prevent overlapping capture and restore from this loaded visit. Draft remains
editable while pending. This is not server locking, cancellation, cross-tab exclusion,
or protection against an operation submitted on an older visit. Reload/reset still
allows a fresh visit, and a previously submitted server operation can complete.

## Designer review
Inspected actual480x900 released-state screenshot: retained draft, readable fixed
restore error and current list, both actions enabled again. Held-request browser
checks verify disabled controls before clicking. No layout or broader responsive claim.

## Security review
Local UI/method guard only, not an authorization or server concurrency boundary.
No new account/provider/scope/disclosure/spend/license/registration. Original owner
upload request recovered verbatim; repository identity/permissions checked live
before publication. No new external destination.

## QA/integration review
API265/31/web298/14 uncached0/builds0. Snapshotbrowser21->23 real held capture:
restore disabled, actual click produces no dialog/restorePOST. Real held restore503:
capture disabled, actual click produces no capturePOST/draft loss. Both reenable
after settlement. Two new units test method guards in both directions.
49unique bounded integration/config legs all inner/outer0; docs4/138routes,
stageconfig16 and reaper4. No failures/timeouts/interruption284.
Syncbrowser STAGED95+144=239unique both0/checkpointremoved, not canonical uninterrupted.
Native STAGED116+128=244total/242unique both0/checkpointremoved, not uninterrupted.
Each browser suite and native stage isolated. No app/test edits after verification.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle585.46kBvs500warning (prior585.40kB), not a new blocking build failure.
