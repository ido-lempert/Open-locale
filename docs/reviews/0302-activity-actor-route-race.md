# 0302 - Activity actor metadata route race

## Developer review
Test-only real browser/API proof for independent actor metadata fences. Holds
oldproject members request, settles activity independently, reuses route for a
separate team's project, then releases old response. Confirms actual old response
contains excluded member, new options exclude them and stay byte-equivalent; feed,
loading/error and editor back link remain on current project. Application unchanged.

## Product review
Confirms project context for actor options; does not introduce project-specific
membership. Members belong to teams: projects on the same team legitimately share
options. Fixture now uses separate owner/team and adds original local owner to
newteam to authorize its reads. No historical/former actor coverage claim.

## Designer review
Fresh480x900 resulting newteam capture inspected: wrapped actor/action/key controls,
refresh and single member-added row readable with no document overflow. No UI change.

## Security review
Discriminating real response payload includes actor absent from target team; proof
cannot pass merely because two lists happen to match. Local fixtures only, no new
production write, provider request, credential scope, spend or license decision.
Original owner authority recovered before upload; no authorization expansion.

## QA/integration review
API265/31/web189/11 uncached0/builds0. Activity16->18; reports118/sync644/
syncbrowser239/QA14 unchanged.45uniqueintegration/configlegs inner/outer0;
reaper4/docs4/138routes0. Native STAGED116+128=244total/242unique PG55534 inner/
outer0/checkpointremoved, not uninterrupted. No app/test edits after native.
Bundle573.51kBvs500warning unchanged. Docker static only/no daemon execution claim.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no remote/baseline advance/
accepted sync/enabledworker. Existing report snapshot/window caveats unchanged.

Chronology: three initial17PASS/1FAIL browser runs. First two-project fixture
incorrectly assumed member lists were project-specific, but both belonged to same
team. Second run also tried wrong userId field. Diagnostic third run confirmed
real API uses id and both projects legitimately had same members. Inspected service
source, changed fixture to separate owner/team with explicit local membership;
final18/0. No application defect/fix. No timeouts/interruption this slice.
