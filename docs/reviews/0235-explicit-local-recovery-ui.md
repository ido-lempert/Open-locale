# 0235 - Separate reviewed local recovery confirmation

## Developer pass
Target review retains only exact scalar recovery input fields,not raw response
scope objects. Value-only review has no mutation input. Separate prepare/cancel/
confirm flow;confirmation captures input and clears private value/bindings before
sending one POST. Existing hide/scope/refresh/navigation cleanup applies. Generation
fencing prevents late outcome replacing another route;no automatic retry.

## Product pass
Confirmation names fresh unverified value,new history,queued effect,no history
replay,unchanged repository/baseline and incomplete sync. Warns queued effects may
run when enabled. Unknown response explicitly allows that write may have happened,
requires current-value check/new review,never claims rollback. No remote write,
baseline advance or enabled worker. Coverage22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
Actual480x900 confirmation and success screenshots inspected. Entire confirmation
notice,escaped archived text and both buttons visible/readable,no horizontal
overflow. Initial success screenshot missed offscreen outcome;fixed outcome focus/
scroll and verified new screenshot shows entire success status below header.
First card heading outside confirmation viewport;lower card below viewport. Scope
select long label truncates within its control;full target remains in review.

## Security pass
No unreviewed automatic mutation. Exact required scalar input only,not raw actor/
project/audit scopes;server remains authoritative. Private value/bindings cleared
before POST and on errors/scope changes. Unit cases verify no send before prepare,
cancel,no retry,scope clearing,late-route fencing. No targeted negative claim.

## QA/integration pass
Web77->82/7 (+5unit cases),API248/30. Initial web failed one obsolete fixture
assertion that no bindings exist;changed contract now retains needed fields while
excluding unrelated raw fields. Browser156->163 (+7):confirmation,layout,cancel,
stale real key change,503 private-error/no retry,actual value/history/intent commit,
visible focused outcome. Initial browser162 before focus fix,final163RC0.
Sync644RC0.43unique integration/config legs in11completed green batches,individual/
outerRC0. Both builds,reaper4,138routesRC0. Existing web500kB budget warning remains
(~555kB),not build failure. No startup issues,timeouts/interrupted calls. Native
staged116+128=244total/242unique,all labels present,inner/outerRC0,checkpoint removed.
Staged visual preceded final static banner wording edit;final browser163/web82/
web build verify final banner. Only docs/OpenAPI description followed. No external
acceptance or remote delivery claim.
