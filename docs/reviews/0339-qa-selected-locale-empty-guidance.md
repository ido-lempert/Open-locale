# 0339 - Scope empty QA guidance to the selected locale

## Developer review
Use current locale for the empty label. One unit covers all/fr/he; existing loading
and error suppression retained. No request/API/schema/data change. No app/test edits
after clean native stages.

## Product review
No findings for one locale does not mean all locales were checked. Name the selected
locale; all-locales empty retains No QA issues found. Does not change check semantics,
matching, capability coverage or add reset-filter behavior.

## Designer review
Inspected actual480x900 selected-fr pixels: selector,0issues and No QA issues found
for fr are readable, no alert/loading. Table retains existing horizontal scrolling;
no broad layout/responsive claim.

## Security review
No new source/disclosure/account/provider/scope/spend/license/registration. Local
fixtures only; request generation guards unchanged. Original authenticated owner
upload recovered before publication; live repository/push/admin/main validated.

## QA/integration review
API265/31/web276->277/13 uncached0/builds0. QAbrowser19->21 adds actual all/selected
empty checks. All47unique integration/config legs inner0 including final docs4/138routes0;
Tasks80/Tasksbrowser31/Glossarybrowser36/Activity28/reports118/sync644/syncbrowser239/
automation132/2FA37/reaper4 complete0. Clean native STAGED116+128=244total/242unique,
PG55534 inner/outer0/checkpointremoved, not uninterrupted.

Two combined120s interruptions: d persisted6legs inner0/BATCH_FAIL0, OIDCbrowser
interrupted1check. Dead6241 PG55477 socket removed; interrupted web stopped; isolated
OIDCbrowser49/0 then SAMLbrowser61/0/link12+55/0. Pages28+31+36/BATCH_FAIL0 and reaper4
completed, then first native interrupted48checks. First native retry EEXIST stale
checkpoint0checks/RC1. Removed empty incomplete checkpoint, dead9499 PG55534 socket
and interrupted fixture processes. Clean isolated first116/0,second128/0. No failed
assertions, no completed legs rerun merely for combined outer status. Future slow
stages must remain separate calls. Progress sends had network/daemon errors; later
fresh status succeeded. No external mutations during interruptions.

Docker static-only/no daemon claim; coverage22FULL/7PARTIAL/1MISSING/defaultOFF
unchanged; no accepted sync/baselineadvance/worker enablement; report snapshot/window
caveats remain. Bundle583.63->583.77kBvs500warning.
