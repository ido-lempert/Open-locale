# 0319 - Glossary deletion pending guard

## Developer review
Per-row deleting ids guard duplicate delete and subsequent save entry. Row input/
delete disabled while pending, through success/failure refetch. Existing captured
project/visit and destroy fence also guard finally; new visit resets visible ids.
Four units cover duplicate/conflict/read lifetime, fixed failure recovery, late
success/new pending and destroy. No API/schema change.

## Product review
Deletion failure asks to inspect glossary before retry and refreshes server terms,
retaining create draft. No automatic retry/cancellation/server idempotency claim.
Already-in-flight translation save is not serialized with deletion in this slice;
translation-save pending/error lifecycle remains separate work.

## Designer review
Deleting term status/row busy and disabled translation/delete controls announce
pending. Actual heldDELETE tests all. Inspected fresh480x900 failure pixels: fixed
guidance wraps readably, retained draft, both real terms/locale fields restored,
no clipping. No redesign or wide-locale claim.

## Security review
Raw delete exceptions replaced by fixed guidance; injected private-glossary-delete
absent in actual page. Original destination/visit/destroy fence respected. Isolated
local API/PG/Chrome fixtures; no provider/account/scope/spend/license/audience change.
Owner upload original recovered before publishing; live main/push access checked.

## QA/integration review
API265/31/web237->241/13 uncached0/builds0. Glossarybrowser11->14 actual heldDELETE
one pointer submission, old-project-only removal/no new-project read/draft clearing,
rejected503 restores persisted term/controls with no raw detail or resend during
200ms observation.47unique integration/config legs including docs final inner/outer0;
Tasks80/Tasksbrowser23/Activity22/QA14/reports118/sync644/syncbrowser239 unchanged.
Reaper4/0/docs4/138routes0. Native STAGED116+128=244total/242unique PG55534 inner/outer0/
checkpointremoved, not uninterrupted. No app/test edits after native. Bundle579.29->
579.92kBvs500warning. Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no remote sync/baselineadvance/accepted sync/worker
enablement. Existing report snapshot/window caveats unchanged.

### Startup failure chronology
SAML PG55476 failed bind twice,0checks/inner0 misleading; batch correctlyouter1.
Closed TCP probe/no live PG afterward; no process killed. Temporary identical test
copy changing only PG to55540 passed55/outer0, then removed. Later standard55476
passed55/innerouter0. Other five legs from initial batch rerun cleanouter0 too. No
application/assertion failure or outer120s interruption253.
