# 0165 - Independent automation channel checkpoint

## Developer pass
New explicitly invoked internal automation-only step composes existing queue runner
and guarded adapter. Success writes automationHandledAt with live token/deadline
fencing; channel replay skips. Additive nullable migration, generated client/build
and full migration deploy checked. No timer/public route/combined worker.

## Product pass
Checkpoint means channel handler bookkeeping, not receipt or overall sync/webhook
completion. Failed aggregate never checkpoints. Crash between side effect and
checkpoint permits duplicates; partial per-rule retries still need a ledger.
No public apply/baseline advance/remote write/external acceptance;22FULL/7PARTIAL/
1MISSING unchanged.

## Designer pass
No UI. Existing current1280x800 editor screenshot inspected: readable locale columns,
saved state/memory suggestion without overlap. No new visual-feature claim. README/
plan distinguish automation channel from webhook/overall completion.

## Security pass
Checkpoint requires matching leased token and database-clock unexpired deadline.
Expired after effect cannot checkpoint or settle completion. Current-intent/rule/
per-locale/post-computation/per-notify-attempt guards retained. Replay still passes
runner eligibility before skip. No registration/scope/spend/license/audience change.

## QA/integration pass
Automation74->78: actual task/activity plus independent checkpoint/webhook untouched;
checkpointed requeue after closing first task skips both task and activity (title
OPEN dedup cannot mask replay); failed aggregate requeues without checkpoint;
expired post-effect lease leaves actual task but no checkpoint and stale status.
Failure aggregate uses existing explicit notify failure double,not external acceptance.
Initial fixture requeued completed row without clearing finishedAt: constraint
correctly rejected after75 checks,RC1. Fixed fixture only to clear finishedAt;
constraint unchanged. Clean78 rerun and final sweep. No host interruption99.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs14 clean
fail-closed batches,all individual/outerRC0;48 inventory. Webhook45,migration10,
sync268/browser98. Native116+128=244 total/242 unique,all242 literal source labels
covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted. Initial failed
fixture exit left temporary bundles until clean rerun;none/services active at end.
