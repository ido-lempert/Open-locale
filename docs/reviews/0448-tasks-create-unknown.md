# 0448 Unconfirmed task creation recovery

## Developer review
Visit-local createUnknown blocks captured and DOM create handlers, not independent
row operations. Shared explicit all-task recovery resets status/assignee filters
and search while keeping the whole new-task form. Ordinary successful reads and
filtered recovery cannot unlock. Mutation epoch changes at create start/uncertain
outcome; pending-at-start/current and current-list fences reject reads begun
before/during a later unknown request. Project/reset/destruction fences retained.
No API/schema/dependency changes.

## Product review
Task creation can commit while its response is lost and filters hide it. Require
Read all tasks and list inspection before retrying; no automatic POST/read. Form
retains title/context/date/assignee/predecessor/keys/lock selection. Confirmed
receipt plus failed follow-up read stays confirmed, not unknown. Row recovery and
create recovery share a read without implying new mutations. Visit-local only,
not persistent request deduplication, exactly-once, cancellation or causation proof.

## Design review
Desktop and390px actual pixels inspected. Initial screenshot exposed a retained
predecessor displayed blank when filtered out. Added an explicit selected-outside-
list option, then shortened its label so it stays within the narrow form panel.
Final pixels inspected, units/build/new browser repeated. Specific unknown banner
suppresses matching generic create error only; independent row error still visible.
Recovery warns that filters/search clear and form stays.

## Security review
No raw exception details or automatic create replay, row operations still enforce
existing readiness/permissions. Successful ordinary reads cannot clear uncertainty.
Captured-handler browser check covers disabled-button bypass. Original owner
upload authority recovered verbatim and live exact repo/branch checked before
upload. No external account/worker/spend/credential-scope changes.

## QA/integration review
New unit9, web847/78 suites/API265/31/builds0. Initial web846/1 obsolete deliberate-
retry expectation corrected to pause. Existing tasks-browser fixture aligned before
run then31/0. Initial new browser twice5/2: fixture compared Angular decorated DOM
key option to raw persisted ID and mobile coordinate recovery click missed; fixed
model comparison/DOM click with enabled fence then10/0. Pixel corrections afterward
also retested units/build/browser10/0. Browser forwards real create to API/Postgres,
then drops browser response after commit; verifies whole form, no replay, ordinary
read stays paused, independent row update/error, failed/successful all-task recovery
and explicit next different create once. Final all API and75 isolated browsers0;
separate sync95+144=239unique and native116+111+19=246total242unique/four startup
repeats, inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Completed checks
preserved across runs, no interrupted tests or canonical uninterrupted claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
