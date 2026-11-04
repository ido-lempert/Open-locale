# 0340 - Repeated-visit glossary list failure proof

## Developer review
Test-only. Hold first A glossary GET, navigate same component A->B->A, wait for
current successful table and locale metadata, edit whole draft, then release503.
Compare exact current table text and draft. Existing fetchSeq fence suffices; no
application/API/schema/request behavior change or app/test edits after native stages.

## Product review
An old failed list must not hide a newer successful glossary or discard its draft.
Actual transport proof adds coverage, not a new capability or cancellation guarantee.
No claim about all concurrent mutation/refetch paths.

## Designer review
Inspected actual480x900 post-failure pixels: current fr/de columns and rows remain,
new-term text/context/checked do-not-translate stay, refresh enabled, no error/loading.
Existing narrow inputs clip long values. No layout change or broad responsive claim.

## Security review
Injected503 contains private-old-glossary-list marker; assertion proves raw detail
is not rendered. Local fixtures only, no new source/disclosure/account/provider/
scope/spend/license/registration. Original authenticated owner upload recovered; live repository/
push/admin/main validated before publication.

## QA/integration review
API265/31/web277/13 uncached0/builds0. Glossarybrowser36->38: actual late failed
first-visit list cannot hide current table/whole draft or publish alert/retry/loading;
private marker/runtime/overflow checks. All47unique integration/config legs inner/
outer0 including docs4/138routes. QA21/Activity28/Tasks31/Glossary38; Tasks80/reports118/
sync644/syncbrowser239/automation132/2FA37/reaper4 all0. Native STAGED116+128=244total/
242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted. Each browser
suite and native stage isolated. No suite failures/timeouts/interruption274.

Docker static-only/no daemon claim; coverage22FULL/7PARTIAL/1MISSING/defaultOFF
unchanged; no accepted sync/baselineadvance/worker enablement; report snapshot/window
caveats remain. Bundle583.77kBvs500warning unchanged.
