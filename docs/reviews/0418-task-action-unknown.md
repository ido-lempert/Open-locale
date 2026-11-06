# 0418 Task row unknown-action recovery

## Developer review
Unknown update/delete no longer starts an automatic list read. Page-local unknown
state guards both handlers and every row control, including captured stale handlers.
Read all tasks clears/persists filters and requests explicit recovery. Only latest
successful unfiltered read with no pending mutation at start/end and unchanged
mutation epoch clears uncertainty. Captured unfiltered state prevents a filtered
read masquerading as full after filters change. Project/destroy fences remain.
Creation and confirmed receipts stay independent; no general reconciliation.

## Product review
Filtered empty list cannot establish whether a change persisted. Recovery exposes
all saved tasks, not another write. Failed/ordinary/filtered reads remain paused;
check tasks before choosing another change. Creation draft remains available.
This is page-local replay protection, not outcome detection, durable uncertainty,
idempotency, cancellation or exactly-once changes. Reviewed exact dependency/cycle
rejections retain actionable guidance and ordinary refresh.

## Design review
Inspected actual task-action-unknown desktop screenshot: warning and Read all tasks
above retained form, fixed mutation error separate, failed-list/retry below.
Text and controls are readable without overlap; guidance explicitly says filters
will clear. Ordinary Retry tasks does not silently release row-action pause.

## Security review
No raw server details. Unknown state cannot be bypassed through old row handlers.
No API/schema/credential/worker/provider/account/scope/license/spend changes.
Owner upload evidence/live target verified before push. No external acceptance
promotion.

## QA/integration review
Unit10: both actions, no automatic read/replay, failed/successful explicit recovery,
ordinary/filtered reads, pending write/read epoch, confirmed success/read failure,
project/destroy and known rejections. Initial web683PASS1FAIL obsolete automatic-read
expectation corrected; final694/50 all0. Script syntax check caught one fixture
parenthesis and corrected before browser execution. API265/31 builds0 initial442.18kB.
New browser initial7/0, strengthened10/0: actual rejected PATCH/DELETE, no automatic
GET/replay, persisted OPEN/row unchanged, filtered/failed reads retain pause, explicit
all-task read unlocks and draft remains. Held real PATCH plus GET started during
pending write cannot clear later unknown result; captured handlers send nothing.
Existing tasks31/0 after explicit recovery/readiness fixture updates. All other API
and isolated browser suites0. Sync staged95+144239unique/native116+111+19246total
242unique/four startup repeats, every inner/outer0; no uninterrupted claim.
Completed checks retained across duration pauses, no interrupted check. Final
config16/14 docs4-138routes/reaper4 all0; checkpoints removed.22FULL7PARTIAL1MISSING/
defaultOFF and external acceptance unchanged.
