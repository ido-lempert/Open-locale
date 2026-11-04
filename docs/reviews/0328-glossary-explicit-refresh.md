# 0328 - Explicit glossary list refresh

## Developer review
Add explicit refresh using existing latest-request/visit/destroy fenced list fetch.
Pending disables control and guards duplicate refresh. Terms-only read does not
reload metadata or change new-term draft. Two units prove exact project read,
locale/draft preservation and pending/destroy suppression. No API/schema change.
No app/test edits after native stages.

## Product review
Users can check server state after uncertain mutations or external changes without
reload/mutation. Actual externally added term appears. This refresh deliberately
replaces row translation fields, not unsaved-row retention. Review added visible
server-replacement/new-term-draft guidance before final units/build/browser/native.
Not cross-client concurrency, cancellation, automatic refresh or synchronization.

## Designer review
Inspected fresh actual480x900 final pixels: refresh control and readable replacement
hint fit; externally added row/context visible, whole new-term draft/checked box
retained, no pending/error. Narrow translation input text scrolls normally. No wide
locale/content fit or broad responsive redesign claim.

## Security review
Existing read permissions/source unchanged. No extra disclosure/account/provider/
scope/spend/license or external registration change. Local fixtures only. Existing
latest-request/visit/destroy fences remain. Owner upload original recovered; live
repository/push/main validated before publication.

## QA/integration review
API265/31/web262->264/13 uncached0/builds0. Actual held refresh suppresses duplicate,
clears stale rows rather than empty success, retains whole new-term draft; release
shows actual added term without metadata read and releases control: glossarybrowser
29->31. Final47unique integration/config legs inner/outer0 including docs4/138routes.
Tasks80/Tasksbrowser26/Activity22/QA14/reports118/sync644/syncbrowser239/reaper4 unchanged.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved, not
uninterrupted. Known slow suites isolated. No failures/timeouts/interruption262.
Docker static-only/no daemon claim; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
No accepted sync/baselineadvance/worker enablement; existing report snapshot/window
caveats unchanged. Bundle582.35->582.83kBvs500warning.
