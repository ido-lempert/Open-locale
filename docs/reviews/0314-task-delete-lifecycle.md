# 0314 - Task deletion lifecycle

## Developer review
Per-row deletion ids extend rowPending to guard both update/delete entry points.
Delete captures destination and visit generation; current/nondestroyed callbacks
alone may publish error, read list or release pending. New visits reset pending.
Six units cover duplicate and conflicting update, refresh lifetime, fixed failure,
repeated-project success/failure, destroy and independent rows. No API/schema.

## Product review
Deletion failure asks to inspect list before retry and reads server state because
transport failure may be ambiguous. No automatic retry or cancellation/idempotency
claim. A held request may finish at original project; new visit stays independent.
No new destructive capability or broadened permission; existing delete flow hardened.

## Designer review
Shared rowPending disables status, dependency, assignee and delete during deletion;
row busy and Deleting task status explain why. Inspected actual480x900 failure
pixels: fixed guidance readable, unsaved title retained, existing DONE task and
controls restored, no clipping. No layout redesign.

## Security review
Arbitrary deletion errors not reflected; injected private-delete-detail absent from
actual browser. Original destination fixed, callbacks visit/destroy fenced. Tests
use isolated local Chrome/API/PG; no external sync/provider/account/scope/spend/
license change. Owner upload original recovered before publication; live remote
push access and main verified. No new audience.

## QA/integration review
API265/31/web217->223/12 uncached0/builds0. Tasksbrowser18->21: held actual DELETE
suppresses duplicate pointer click/all competing row controls; late deletion removes
only original project target without new-project read/draft change; rejected503
restores real persisted row/enabled controls, no raw detail/resend during200ms
observation.46unique integration/config legs including docs inner/outer0. Tasks80,
Activity22/QA14/reports118/sync644/syncbrowser239 unchanged. Reaper4/0/docs4/138routes0.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not
uninterrupted. No app/test edits after native; no failures/timeouts/interruption248.
Bundle576.85->577.34kB vs500warning. Docker static only/no daemon execution claim.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted sync/baselineadvance/
remote writes/enabled worker. Existing report snapshot/window caveats unchanged.
