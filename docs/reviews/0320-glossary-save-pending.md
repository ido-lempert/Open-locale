# 0320 - Glossary translation save pending guard

## Developer review
Save reads latest immutable row by id and copies translations at submission. Per-row
saving ids guard duplicate save/delete, shared rowPending disables translation/delete
through request. Existing visit/destroy fence protects error/finally; new visit resets
ids. Four units cover latest bytes/conflicting delete, retained failure text, late
completion/new pending and destroy. No API/schema. No server concurrency guarantee.

## Product review
Failed save keeps edited text in place with fixed inspect-before-retry guidance;
it does not refetch and discard it. Already-started save blocks subsequent deletion.
No auto-retry/cancellation/idempotency claim. Other successful mutations can still
refetch the page and replace local unsaved edits; broader draft retention separate.

## Designer review
Saving translation status/row busy/disabled fields and delete explain pending.
Inspected actual480x900 failure pixels: readable wrapping guidance and both edited
inputs retained/enabled. Narrow inputs horizontally scroll their text by normal
input behavior; full exact values checked in browser. No wide-locale layout claim.

## Security review
Arbitrary save errors replaced by fixed message; actual private-glossary-save absent.
Latest row required before write; captured original project/visit fence preserved.
Local isolated API/PG/Chrome only; no account/provider/scope/spend/license/audience
change. Original owner upload recovered before publication; live main/push checked.

## QA/integration review
API265/31/web241->245/13 uncached0/builds0. Glossarybrowser14->17: actual typed text
blur/heldPATCH saves latest map once and disables conflicts; rejected503 retains
unsaved text/fixed guidance/enabled fields, no raw detail/resend during200ms observation.
47unique integration/config legs including docs inner/outer0; Tasks80/Tasksbrowser23/
Activity22/QA14/reports118/sync644/syncbrowser239 unchanged. Reaper4/0/docs4/138routes0.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not
uninterrupted. No app/test edits after native. Bundle579.92->580.38kBvs500warning.
Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged;
no remote sync/baselineadvance/accepted sync/worker enablement. Existing report
snapshot/window caveats unchanged.

### Fixture failure chronology
First web run aborted/rc1: older late-save fixture had no current term row, so new
current-row guard correctly skipped the write and its manual rejection was an
unconsumed promise. Seeded fixture current row (matching actual screen); no assertion
removed. Final web245/13 uncached0. No application/assertion FAIL or outer120s interruption.
