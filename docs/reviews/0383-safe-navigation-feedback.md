# 0383 - Safe navigation feedback

## Developer review
Root listens to router NavigationStart/End/Cancel/Error, settles only active
navigation ID. Destroy unsubscribes. New start clears failure; cancellation is not
error. Fixed messages never echo URL/error. Current routed component remains as
router decides; no app-driven reload/retry/redirect that could lose drafts. Two
unit cases cover ID races, cancellation/destruction and rendered safe guidance.

## Product review
Lazy chunk failure previously left the old screen with no visible explanation.
Pending banner says opening; failure says previous screen may remain and keep
unsaved work before refresh or another link. No automatic refresh. Not chunk
retry/recovery: browser may cache failed import until reload. Guidance also covers
other NavigationErrors, no promise the previous component always exists on first
load. Existing successful navigation/auth behavior retained. No API/worker change.

## Designer review
Initial inline banner was outside viewport when click occurred deep in settings;
actual screenshot review caught this despite initial20 passing DOM checks. Changed
to fixed bottom viewport banner; added bounding-box visibility checks. Final390px
pending and failure pixels inspected, readable full guidance at current scroll.
Banner overlays bottom content while shown; users can scroll or navigate above it,
no modal/focus trap. No auto-scroll that would move an unsaved editor. Existing
screen unchanged otherwise. No claim of all screen-size/accessibility audit.

## Security review
No raw NavigationError/URL shown, no credential or query data persisted. No reload
loop or automatic retry/request/mutation. Router guards and server authorization
unchanged. Test-only controlled chunk abort, isolated disposable DB/local server;
no external service/audience/spend/license/credential change. Original named-repo
upload authority recovered before commit.

## QA/integration review
API265/31 web340/17 uncached/builds0. Production browser16->20 initial PASS but
viewport review changed app as above; final22PASS inner/outer0 includes actual held
chunk, aborted fetch, retained unsaved settings draft/no auto reload, next eager
navigation clears banner, pending/error visible in390px viewport. Prior16checks
retained. OTA browser twice8PASS then timeout at existing clear-search/type step;
fixture now waits for empty ngModel input after clear, app unchanged, final25PASS0.
No failure concealed; both aborted checks in parent chronology. All52 bounded
integration/config legs final inner/outer0, docs4/138routes/config16/reaper4. Each
browser/native stage isolated. SAML55576/native55584 checkedfree to avoid earlier
stale sockets. Sync STAGED95+144=239unique/native STAGED116+128=244total242unique
all inner/outer0/checkpointsremoved, not canonical uninterrupted. No app/test edits
after final stages. Docker static-only, coverage22FULL/7PARTIAL/1MISSING/defaultOFF
unchanged. Bundle below, unchanged500budget.

Finalinitial407.05kB (previous405.86kB), no budgetwarning.
