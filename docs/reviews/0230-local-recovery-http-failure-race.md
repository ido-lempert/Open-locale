# 0230 - Recovery HTTP failure and concurrency evidence

## Developer pass
Tests only,no app behavior changes. Actual HTTP requests exercise production
controller/service/Prisma transaction code. Temporary database trigger restricted
to one fixture key forces intent INSERT failure after earlier recovery writes;
trigger/function removed in finally. Fixture row/audit/activity/intent cleanup.

## Product pass
Proves the new explicit local recovery route reports busy409,unknown fault500,
and competing requests yield one201/one409. Does not claim remote sync,delivery,
new restore UI or exactly-once external effects. Coverage22FULL/7PARTIAL/1MISSING,
worker defaultOFF unchanged.

## Designer pass
No UI change. Actual480x900 fixture screenshot inspected:existing focused review
result,target/path/UTC/no-reservation/no-restore-UI notice,escaped value and controls
readable,no horizontal overflow. First heading partly behind sticky header,second
card below viewport. Read-only UI fixture,not a visual mutation test.

## Security pass
Actual PostgreSQL project row lock causes public busy409 with unchanged recovery
counts and absent locale row. Actual intent-insert trigger exception causes500,
private database error absent from response,all recovery counts unchanged and
absence marker retained. Competing actual HTTP requests yield one fresh row,
history,activity and intent;archive retained,marker removed,baseline unchanged.
No app hooks or synthetic HTTP faults. Concurrency case is competing requests,
not proof they reach the same internal instruction simultaneously.

## QA/integration pass
Sync625->629(+busy,+fault,+race winner/effects,+race archive/baseline). Initial/final
629RC0. Rebuilt busy-code negative control627pass/2expectedfailRC1 exactly service
and HTTP busy classification;restored source/rebuilt629RC0. No app changes remain.
43unique integration/config legs in11completed green batches,individual/outerRC0.
Browser156,API248/30,web77/7,both builds,reaper4,138routes allRC0. Migration22,
automation132,webhook45. No startup issues,timeouts/interrupted calls or unrelated
failures. Native staged visual116+128=244total/242unique,all242literal labels
present,inner/outerRC0,checkpoint removed. Staged,not uninterrupted. Only docs
changed after final integration runs;docs/API build rechecked precommit. No
production/external acceptance claim.
