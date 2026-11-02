# 0238 - Configuration refresh clears private recovery review

## Developer pass
Configuration refresh previously incremented generation but retained visible
archived value and prepared recovery bindings. Clear review target,loading marker,
private value/bindings and eligibility preview synchronously after busy guard and
before refresh await. Success with unchanged revision cannot resurrect the old
review;failure remains cleared. Busy guard prevents refresh interfering with a
pending recovery. Server remains authoritative;no server change.

## Product pass
Refresh now requires explicit new target/value review and prepare/confirm. Failed
configuration refresh cannot preserve an earlier prepared action. Metadata page
stays available;target selector resets to value-only. No recovery request is sent
by refresh. No remote write/baseline advance/accepted sync/worker enablement.
22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
Actual480x900 failed-refresh screenshot inspected,including final run. Full banner,
error,refresh/audit buttons and reset value-only selector readable. No private
archived text or recovery controls remain;metadata card continues below viewport.
No horizontal overflow visible. Screenshot uses local fixture data. Existing raw
configuration error presentation unchanged,not broadened to archived-value errors.

## Security pass
Sensitive reviewed bytes and execution bindings removed before network refresh,
including failed response,not merely after updated target list. Unit direct call
cannot execute old prepared recovery after refresh. Real browser held GET proves
clearing before response;unchanged target and synthetic503 cases prove no revival.
This is private-state clearing,not memory erasure. No new grant/API or targeted
negative-control claim. Server stale-binding enforcement unchanged.

## QA/integration pass
Web85->88/7(+3refresh/pending guard cases),API248/30 unchanged. Browser170->173
(+3held-refresh/unchanged-response/failed-refresh checks). Initial browser139passes/
one suite-abort failure:fixture queried confirmation DOM before Angular rendered
it after re-preparing;added explicit wait. Full173green twice afterward,web88final
RC0. No startup failures,timeouts/interrupted calls172. No old-code negative claim.

43unique integration/config legs in10completed green batches,individual/outerRC0.
Sync644,browser173,both builds,reaper4,docs4/138routesRC0. Existing~555kBvs500kB web
budget warning persists,not build failure. Native STAGED116+128=244total/242unique,
inner/outerRC0,checkpoint removed,not uninterrupted. No app/test changes afterward;
web88/browser173 reran,then docs only.
