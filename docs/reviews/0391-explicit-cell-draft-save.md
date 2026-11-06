# 0391 - Explicit current-cell draft save

## Developer review
Dirty compares value and complete plural forms to last confirmed baseline. Button
calls existing conditional save, disabled on pending review/content/needsReload/
loading/error/destroy; runtime save guards remain. No new API/write path. Pending
review status text explains newer input is local. No automatic retry, save queue
or draft persistence. Unknown result still requires copy+explicit reload. Loaded
metadata validation occurs in save as before, no unconditional fallback.

## Product review
A user typing then blurring while review request pending could leave newer text
local with no obvious next action. Explicit Save draft makes that state actionable
without another focus/blur. Dirty guidance distinguishes last confirmed save from
current local text. Pending review cannot trigger automatic content write, explicit
button after completion uses confirmed new baseline. Existing blur behavior remains
for ordinary edits; no general exactly-once or network outcome recovery claim.

## Designer review
Existing cell-foot control style retained. Pending text, dirty guidance and disabled
Save draft wrap within cell; actual desktop pending/ready/saved pixels inspected,
readable with no clipped text. Completed save removes dirty controls, returning
normal cell layout. Not a wide-grid redesign/fullmobile/accessibility audit.
Status pending has role=status, button explicit type. Existing grid width can shift
while long guidance appears, no fixed-width-column claim.

## Security review
No new backend, external connection or credential/provider change. Button reuses
conditional version/immutable identity enforcement and local pending guards;
never a force-overwrite or retry after unknown result. No raw error or persistence
of local text outside existing component. No spend/license/worker enablement.
Original named-repository upload evidence recovered before commit.

## QA/integration review
API265/31 web384/25 uncached/builds0 initial417.44kB below500budget. New2 unit checks
plain/plural dirty and disable states. Actual browser4PASS0: held statusPATCH then
new input/blur leaves zeroPUT, pending save disabled; release leaves DB Original/
REVIEWED and zeroPUT, explicit button sends1PUT/persists new text UNVERIFIED/removes
dirty guidance. No325 failure/timeout/interruption. All60 bounded integration/config
legs final0 (59prior+draftbrowser4), config16/docs4-138routes/reaper4. Browser/native
stages isolated. SyncSTAGED95+144239unique/nativeSTAGED116+128244total242unique all
inner/outer0, not canonical uninterrupted. Checkpoints removed/no app-test edits
after native. Docker static-only/coverage22FULL7PARTIAL1MISSING/defaultOFF/external
acceptance limits unchanged.
