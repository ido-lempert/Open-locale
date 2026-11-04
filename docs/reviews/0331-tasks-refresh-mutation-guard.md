# 0331 - Guard explicit Tasks refresh during mutation

## Developer review
Share creating/updating/deleting pending state with refresh disabled binding and method
guard. Explicit refresh cannot replace list with pre-write values during held mutation.
Three units independently prove create/update/delete suppression and eligibility after
settlement. No API/schema change; existing visit/destroy/list sequence fences remain.

## Product review
Matching glossary protection for manual Tasks refresh only. Filter reads and other
mutation-triggered reads remain separate; not all read serialization, concurrency,
idempotency or cancellation. New-task draft and selected filter remain unchanged.

## Designer review
Inspected fresh actual480x900 pending-update pixels: refresh visibly disabled, row
controls disabled/updating status visible, draft retained and narrow layout fits.
Successful later creation browser check verifies refresh enabled after settlement.
No broader layout redesign/responsive claim.

## Security review
Local pending guard is not authorization or cross-client concurrency control. No new
source/disclosure/account/provider/scope/spend/license or registration. Isolated local
fixtures only. Existing visit/destroy guards retained. Owner upload/live push/main
revalidated before publication.

## QA/integration review
API265/31/web267->270/13 uncached0/builds0. Actual held POST/PATCH/DELETE each pointer
refresh attempt produces no GET/no list loading during150ms observation; final creation
settlement also restores refresh control. Tasksbrowser26->29, no assertions weakened.
Final47unique integration/config legs inner/outer0 including docs4/138routes.
First isolated syncbrowser120s interrupted at233checks; deadPG7473/noTCP verified,
leftover suite Nx/Chrome stopped/stale55479 socket removed. Other browser14/22/36 green.
Clean retry isolated120s interrupted at222checks; deadPG8915/noTCP verified, stale
socket removed/leftover suite Nx/Chrome stopped. Neither partial run is a pass.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not
uninterrupted. Reaper4/0. No app/test edits after native. Publication held across one wake; fresh isolated resumed syncbrowser239/inner0/outer0
on unchanged source. Prior units/build/native retained, not repeated solely for outer
status. All application/test changes predate native.

Docker static-only/no daemon claim; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
No accepted sync/baselineadvance/worker enablement; report snapshot/window caveats
unchanged. Bundle583.08->583.22kBvs500warning.
