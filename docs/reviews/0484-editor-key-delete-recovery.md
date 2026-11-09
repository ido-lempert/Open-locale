# 0484 Recover unconfirmed key deletion

## Developer review
Existing unknown deletion guards already block replay. Added recovery readiness
requires current loaded unknown key, healthy settled grid, no deletion or tag
write pending and not departed. Captured handler repeats guard. Uses existing
local read-only/copy/retry route, no read or write during prepare. Pending-delete
status stays beside row; unknown warning/control now outside inert table.
No API/schema/deletion behavior change.

## Product review
Unknown deletion notice previously required copy/reload without direct recovery.
Now users can reach retained local translation values without risking blur save.
Explicit read replaces translations, so copy first. Failed read keeps grid
read-only; successful read reflects current keys, not request attribution.
No deletion replay, automatic read, durable uncertainty or exactly-once claim.
Existing reload clears per-key errors while whole-grid read state guards failure.

## Design review
Moved unknown warning and recovery above grid, outside inert table, for a usable
390px control. Final desktop/390px actual pixels inspected: wrapped warning,
retained-copy text and local translation readable. Recovery disabled after grid
is locally paused. Pointer mousedown prevents unrelated translation blur save.
Pending deletion remains row-specific. No unrelated layout redesign.

## Security review
No new endpoint/dependency/license/registration/spend/worker/credential change.
Unknown delete cannot replay through captured handler. Fixed warning omits
backend details; copy is local values only, not confirmed saved/import data.
No disclosure to new audience or external provider.

## QA/integration review
10 new units/web1172 in114 suites/API265 in31/both builds0 (API cached).
New real browser8/0 first pass and sweep: committed-then-lost delete, disabled and
captured refusal, focused recovery zero reads/writes, unrelated local values and
unknown deleted row retained in copy, failed explicit read stays read-only,
successful read removes actually deleted row without replay,390px controls.
Units exercise readiness guards and failed/successful explicit reads.
All API/111 isolated browsers first-pass0, no failed/aborted checks. Separate
sync95+144=239unique; native116+111+19=246total242unique/four startup repeats,
all inner/outer0 first pass. Config16/14/docs4-138routes/reaper4 all0. Completed
checks preserved across continuation; staged, not uninterrupted. Coverage
22FULL7PARTIAL1MISSING/defaultOFF unchanged.
