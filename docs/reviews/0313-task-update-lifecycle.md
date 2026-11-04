# 0313 - Task update lifecycle

## Developer review
Per-row pending ids guard duplicate updates and competing deletes. Update captures
project destination and visit generation; success/error/finally require current
visit and nondestroyed component. New visit resets pending ids. Distinct rows may
update independently. Nine units cover current success/failure/read lifetime,
same-row conflict, different rows, repeated-project success/failure, destroy and
exact domain guidance. No API/schema/query change. Delete's own lifecycle remains.

## Product review
Current failure reverts the control then reads server state, because a network
error can be ambiguous. Default guidance asks to inspect list before another try.
Initial blanket fallback hid actionable established blocked-predecessor/cycle
messages. Native test caught this before commit. Exact reviewed messages are now
preserved; extended/lookalike messages are not. Old request may finish at original
project; no cancellation, server idempotency or automatic retry claim.

## Designer review
Actual held PATCH marks row busy, announces Updating task and disables dependency,
status, assignee and delete. Inspected fresh480x976 failure pixels: title draft
retained, fixed guidance readable, restored OPEN controls and both tasks visible.
No layout clipping/redesign; document height exceeds viewport and scrolls normally.

## Security review
Exact two-message allowlist retains known domain guidance without reflecting raw
arbitrary exceptions; extended domain-looking private string tested. Destination
captured before request and callbacks fenced by visit/destroy. Isolated local
Chrome/API/PG fixtures only. No spend/account/scope/license/audience changes.
Authenticated owner upload original recovered before publication; remote checked.

## QA/integration review
API265/31 unchanged uncached0; web208->214 then217/12 uncached0. Both builds0.
Tasksbrowser15->18 actual heldPATCH/pinned destination/failedPATCH recovery final0.
46unique integration/config legs including docs inner/outer0; Tasks80/Activity22/
QA14/reports118/sync644/syncbrowser239. Reaper4/0/docs4/138routes0. Integration sweep
preceded exact-domain correction; web units/build, Tasksbrowser/config and fresh
native stages ran after that correction. App/test source unchanged after final
native. Final native STAGED116+128=244total/242unique PG55534 inner/outer0, checkpoint
removed; not uninterrupted. Bundle575.89->576.85kB vs500warning. Docker static only.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no remote sync/baselineadvance/
accepted sync/worker enablement. Existing report snapshot/window caveats unchanged.

### Failure chronology
Tags first startup failed binding55436:0checks/inner1/batchouter1. Other11 legs
finished inner0. Immediate standard-port tags9/0; no process killed or port changed.
Later reran other10 plus config to establish clean outer0 for all. No false green.
Initial native first116/0, second71PASS then suite incomplete/outer1 waiting for
blocked-predecessor text hidden by generic fallback. Fixed app exact allowlist and
three extra units; also fixed one remaining chain fixture full-row title lookup to
use own strong title (other rows include task names as dependency options). No
assertion removed. Fresh first116/second128 both0. No outer120s interruption247.
