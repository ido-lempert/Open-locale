# 0481 Pause unconfirmed empty-branch creation

## Developer review
Unknown create state guards form and captured create handler. Explicit current-
branch check requires unknown state, not departed and no pending list/create.
Existing list generation fencing plus new create epoch prevents older reads
from clearing newer unknown results. Current successful list clears pause only
outside a pending create. No API/storage/payload/key reload or branch switching
change. Confirmed create plus failed list remains independent.

## Product review
Warning previously asked for a check without stopping immediate replay. Now
creation pauses until a current branch read succeeds. Checking does not retry
creation, prove which request created a branch, discard newer text, switch
branches or reload translations. Failed read keeps pause. Branch name and local
translation drafts remain. No cancellation/exactly-once/remote sync claim.

## Design review
Final desktop/390px pixels inspected. Paused create button, warning and recovery
fit viewport. Design pass removed duplicate generic Retry branch list while
unknown state is present, leaving one guarded recovery control. Pointer
mousedown keeps translation focus without autosave. New branch input remains
editable for newer local draft. Existing ordinary list retry stays unchanged.

## Security review
No endpoint/dependency/license/registration/spend/worker/credential change.
Captured duplicate create refuses unknown state. Fixed warning omits backend
detail. Older list response cannot authorize clearing newer uncertainty.
Recovery only reads current project's branch list; no automatic write.

## QA/integration review
8 new units/web1135 in111 suites/API265 in31/both builds0 (API test/build cached).
New real browser7/0 initial, after design fix and sweep. Actual committed-then-
lost POST, form/captured duplicate guards, newer branch draft, focused pointer
failed branch-only read with zero saves/key reads, pending duplicate check,
actual persisted branch options/current successful recovery and390px. Units
cover older-list epoch fence, failed read/draft retention and recovery guards.
All API/108 isolated browsers first-pass0, no failed/aborted runs this slice.
Separate sync95+144=239unique; native116+111+19=246total/242unique/four startup
repeats, all inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Completed
results preserved across continuation; staged/no uninterrupted claim.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
