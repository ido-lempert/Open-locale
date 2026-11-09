# 0493 Safe focused failed branch-list retry

## Developer review
Explicit retry shares readiness between UI and captured handler: failed list,
not reading/creating, no unknown creation and not departed. Pointer mousedown
preserves focused translation. General loader generations and create continuation
unchanged; no API/storage change. Failed retry remains retryable; healthy or
pending captured calls refuse reads.

## Product review
Failed branch-list retry now reads only current branches without saving local
translations, creating branches, switching branch or reloading keys. Existing
new-branch draft and grid remain. This does not establish attribution for an
unknown create; that separate check-current-branches route is unchanged.

## Design review
Actual desktop/390px pixels inspected: fixed branch-list error/retry fit, retained
focused local translation readable on desktop. Existing labels/layout unchanged.
Mobile screenshot intentionally frames error/retry controls; retained local
value/focus also verified in real browser assertions.

## Security review
No endpoint/auth/dependency/license/registration/spend/worker/credential change.
Captured healthy/reading/creating/unknown/departed retry refuses action. Existing
authenticated branch read and generation fences preserved. No unrelated save.

## QA/integration review
7newunits/web1260in122/API265in31/builds0(APItest/buildcached). Newbrowser6/0
initial+sweep: actual failed503/focusedpointer onebranchGET/zero autosave/focus
and local value, heldduplicate captured refusal, storedbranch/currentmain/no
keyreload/create/save, healthycaptured refusal/390px/runtime. Intentionaloldapp
1PASS2FAIL: focus/zero-save assertion then missinghandlerabort/full log retained.
AllAPI/120isolated browsers firstattempt0afterfix/no failureabort. Separate
sync95+144=239unique/native116+111+19=246total242unique/fourstartup repeats,
each inner/outer0firstpass. Config16/14/docs4-138routes/reaper4all0. Completed
checks preserved across continuations; staged/not uninterrupted.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
