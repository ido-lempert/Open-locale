# 0419 Glossary unknown translation save

## Developer review
Per-term unknown-save state guards save/delete and translation-change handler.
Unknown row input is read-only, not disabled, so local values remain selectable
for copying. Unrelated terms remain independent. Save epoch/pending-at-read fence
prevents a read begun during save clearing later uncertainty. Successful later
current full read resets comparison/fields and clears matching guidance; failed
read keeps pause. Project/destroy fences retained. No automatic read/replay.

## Product review
A rejected transport response does not prove the save failed. Pause repeated blur
and deletion for that term. Copy local text before explicit Refresh, which still
replaces all translation fields with saved values. New-term draft remains. This
is page-local uncertainty, not durable recovery, outcome reconciliation or
exactly-once saving. Explicit read can still replace drafts, as copy warns.

## Design review
Inspected actual glossary-save-unknown desktop screenshot: fixed top copy-first
guidance, row-local warning and selectable local text, disabled delete. Unrelated
row remains available. Text/inputs readable without overlap. No redesign.

## Security review
No raw error exposure, no old-handler write bypass. Saved comparison not advanced
on unknown write. No API/schema/credential/worker/account/provider/scope/license/
spend changes. Owner upload evidence and live repository target checked pre-push.

## QA/integration review
New unit5: unknown row save/delete/edit guard, independent row, failed/successful
read, pending-save read, scope/destroy. Existing repeat-blur fixture now asserts
pause. API265/31 web699/51 builds0 initial442.18kB. Actual new browser7/0 holds
PATCH+GET, proves pending read cannot clear later unknown, captured handlers send
nothing, local text selectable/no replay/automatic GET, unrelated real save,
failed read remains paused, successful later read unlocks/new-term draft retained.
Initial new2PASS1FAIL and existing glossary20PASS1FAIL were readiness fixture races:
absence of warning during loading was mistaken for completed read. Wait for read
completion/current row, final7/38. No application assertion failure or interrupted
checks. All final API/isolated browser suites0; sync staged95+144239unique/native
116+111+19246total242unique/four startup repeats, every inner/outer0. No uninterrupted
claim. Final configs16/14 docs4-138routes/reaper4 all0; checkpoints removed.
22FULL7PARTIAL1MISSING/defaultOFF and external acceptance unchanged.
