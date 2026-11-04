# 0324 - Skip unchanged glossary blur writes

## Developer review
Copy fetched translation maps into per-visit comparison map. Save compares current
map keys/values, skips unchanged blur, advances comparison only on successful
current-visit submission. Failed write remains retryable. Two units cover fetched
unchanged/changed/success-repeat and failed deliberate retry. No API/schema.

## Product review
Focusing then leaving a field should not write or add audit noise when nothing
changed. Changed values still save through existing guarded path. Comparison is
last fetched/successfully submitted bytes, not server-normalized truth or cross-
client conflict detection. Other mutation refetch can still replace unsaved edits.

## Designer review
Inspected actual480x900 final pixels: current draft/rows/fr+de fields unchanged,
no needless busy/error after focus/blur. Narrow inputs scroll normally; exact values
verified separately. No new UI or wide-locale claim.

## Security review
No new disclosure or authority. Comparison map reset per project visit; stale save
cannot advance it. Local fixture only; no provider/account/scope/spend/license change.
Owner upload original recovered; remote main and push access checked.

## QA/integration review
API265/31/web247->249/13 uncached0/builds0. Glossarybrowser24->25: actual unchanged
focus/blur produces noPATCH/status/error during200ms observation.47unique integration/
config legs including docs final inner/outer0; Tasks80/Tasksbrowser23/Activity22/QA14/
reports118/sync644/syncbrowser239 unchanged; reaper4/0/docs4/138routes0. Native STAGED
116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted.
No app/test edits after native. Bundle581.31->581.63kBvs500warning. Docker static only/no daemon claim. Coverage22FULL/
7PARTIAL/1MISSING/defaultOFF unchanged; no remote sync/baselineadvance/accepted sync/
worker enablement. Existing report snapshot/window caveats unchanged.

### Interruption chronology
Combined link/QA browser call exceeded120s after OIDC-link12/SAML-link55 inner0;
QA incomplete. Dead PG7403/closed55535 confirmed before stale socket removal; only
interrupted Chrome7521/crashpads7528/7530 stopped. Isolated QA14 and both link legs
rerun cleaninnerouter0. No application/assertion failure; final green does not erase
interrupted run.
