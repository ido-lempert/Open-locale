# 0325 - Render confirmed glossary translation values

## Developer review
Use existing typed update response translations for current row/comparison instead
of submitted bytes. Row identity and visit/destroy guard prevent old response from
replacing a newer immutable edit/refetched row or its comparison. Review tightened
comparison identity guard before final units/build/browser/native. Two units cover
trimmed/removed-empty response, unchanged next blur and newer edit preservation.
No API/schema change; success fixtures now return real response-shaped maps.

## Product review
Server trims values and drops blank translations. Showing submitted whitespace as
saved misstates persisted bytes; UI now reflects confirmed map on unchanged current
row. Other mutation refetch may still replace unsaved edits. No cross-client conflict,
server concurrency or cancellation guarantee.

## Designer review
Inspected fresh actual480x900 final pixels: confirmed field visible, other rows/draft
retained, no pending/error. Narrow input scrolls long text normally; exact trimmed
value verified in DOM/API/response. No layout redesign/wide-locale claim.

## Security review
Existing destination/visit/destroy fence preserved and row identity adds local stale
response protection. No new sources/disclosure or account/provider/scope/spend/license
change. Isolated local fixtures only. Owner upload original recovered and live main/
push checked before publication.

## QA/integration review
API265/31/web249->251/13 uncached0/builds0. Glossarybrowser25->27: actual padded input
blur renders server-confirmed trimmed bytes, matches persisted map, unchanged blur
sends no repeatedPATCH during200ms observation.47unique integration/config legs
including docs inner/outer0; Tasks80/Tasksbrowser23/Activity22/QA14/reports118/sync644/
syncbrowser239 unchanged. Reaper4/0/docs4/138routes0. Native STAGED116+128=244total/
242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted. No app/test edits
after native; no failures/timeouts/interruption259. Bundle581.63->581.78kBvs500warning. Docker static only/no daemon claim.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no remote sync/baselineadvance/
accepted sync/worker enablement. Existing report snapshot/window caveats unchanged.
