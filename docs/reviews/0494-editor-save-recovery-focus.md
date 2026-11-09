# 0494 Safe focused cell-save recovery preparation

## Developer review
UI and captured recovery require loaded error cell/current locale, healthy grid,
no pending key deletion/tag write and not departed. Pointer mousedown prevents
blur saving another focused healthy cell before grid becomes read-only. General
prepareSaveReload and internal callers unchanged; no API/storage change.

## Product review
Review retained values after an unconfirmed save must not save another local
translation. Preparation makes zero requests; both failed and healthy local
values remain in selectable retained text before explicit reload. It does not
retry save, reload, discard or establish whether the failed write committed.

## Design review
Actual desktop/390px pixels inspected: retained-values field, copy guidance,
read-only grid and fixed error readable. Existing labels/layout unchanged.
Focus may leave the input when the grid becomes inert; the guarantee is no
unrelated autosave and preserved values, not focus inside an inert grid.

## Security review
No endpoint/auth/dependency/license/registration/spend/worker/credential change.
Captured healthy/loading/error-grid/deleting/tagwriting/absent/invalidlocale/
departed recovery refuses preparation. Existing save no-replay/read-only and
separate explicit reload boundaries preserved.

## QA/integration review
9newunits/web1269in123/API265in31/builds0(APItest/buildcached). Newbrowser5/0
initial+sweep: actual alphaPUT503, healthybeta focused localdraft, pointeralpha
recovery zero requests/no beta save, both drafts selectable outside inert grid,
390px/capturedrepeat refusal/runtime. Intentionaloldapp2PASS2FAIL: focusedzero-
request assertion then missinghandlerabort/full log retained. AllAPI/121isolated
browsers firstattempt0afterfix/no failureabort. Separate sync95+144=239unique/
native116+111+19=246total242unique/fourstartup repeats, each inner/outer0firstpass.
Config16/14/docs4-138routes/reaper4all0. Completedchecks preserved across
continuations; staged/not uninterrupted. Coverage22FULL7PARTIAL1MISSING/
defaultOFF unchanged.
