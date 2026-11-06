# 0395 - Bulk review respects local work

## Developer review
Guard all loaded cell values/forms against confirmed baseline, pending content or
review, needsReload and unusable grid. One bulk operation; preview rechecks captured
scope plus keys generation before confirmation/write. During bulk, cell save and
single review handlers reject, not only UI controls. Submitted bulk result with
new local work or scope does not reload away drafts: local cells require copy/
reload. Failed bulk response similarly blocks blind replay. Existing server
preview timestamp filtering unchanged; no bulk immutable-row CAS/idempotency or
protection from every other editor mutation.

## Product review
Mark all cannot approve server wording while unsaved local text suggests something
else, or erase that work via reload. Explain blocked state and preserve explicit
user confirmation for clean scope. Preview invalidated by new text never confirms
or writes. Text entered after submit remains local and must be copied before reload.
No automatic content save, bulk retry or outcome reconciliation claim.

## Designer review
Final desktop blocked/retained/reviewed pixels inspected. Initial error layout
squeezed error reason to single-character vertical text; cell footer now wraps
and error reason takes a full row. Re-rendered final retained-draft/copy controls
readable in viewport. No fullmobile/accessibility audit. Existing generic cell
Save not confirmed text also represents a bulk baseline requiring reload.

## Security review
No new API/storage/provider/worker/credential change. Runtime guards and rechecks
avoid disabled-control-only claims; fixed unknown-result message does not expose
backend detail. Server timestamp filter remains, not stronger bulk identity CAS.
Owner upload evidence recovered before commit. No spend/license/scope expansion.

## QA/integration review
API265/31 web418/28 (+14) uncached/builds0. Browser7: dirty guidance/zero preview,
dispatched disabled button cannot bypass, held preview plus typed draft cancels
confirm/write, clean explicit review persists wording/status, held submitted bulk
blocks blur save, completion retains newer draft and copy/reload, no runtime error.
Initial expanded browser6PASS1FAIL found missing copy control with needsReload
alone; temporary weaker assertion passed but designer review restored real control
requirement, app sets explicit error state, final7PASS0. Pixel check then found
single-character error wrapping; CSS fixed, rebuilt and browser7 rerun/pixels checked.
All63 bounded legs final0; older browser legs preceded final CSS-only correction,
new bulk browser7 plus native stages verify final CSS. Config16/docs4-138routes/
reaper4. SyncSTAGED95+144239unique/nativeSTAGED116+128244total242unique inner/outer0,
checkpoints removed/no app-test edits after native; not canonical uninterrupted.
Docker static-only/coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance
limits unchanged.
