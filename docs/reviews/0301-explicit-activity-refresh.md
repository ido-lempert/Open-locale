# 0301 - Explicit Activity refresh

## Developer review
Refresh resets the first page through the existing generation-fenced loader,
retaining action/actor/key filters. Method and disabled control suppress reads
while loading. Destroy remains fenced by fetch. Two units cover retained filters,
page reset, no metadata read, duplicate suppression and destroy. No API/schema.

## Product review
New activity is visible without navigating away or changing filters. This is an
explicit read, not polling or history completeness. Real task created after a
filtered feed load appears after refresh; selected action/actor stay unchanged.
No new writes or permission changes; actor metadata refresh remains independent.

## Designer review
Fresh480x900 actual refresh and metadata-failure screenshots inspected: readable
control above feed, selected actor/action fit, new task and earlier literal title
fit. Failure keeps separate actor-retry and feed-refresh controls. No new overflow.

## Security review
Uses existing authorized project read only. No new backend/polling/secret surface,
HTML binding, provider requests or API/query/schema change. Existing stale response
and project/destroy fences remain. Local isolated fixtures only; no account scope,
spend or license change. Original owner upload/continue authority recovered.

## QA/integration review
Web187->189/11/API265/31 uncached0/builds0. ActualActivity14->16: held real click
suppresses duplicate request and clears old feed; release shows new real task,
preserves filters, no member reload. Reports118/sync644/syncbrowser239/QA14.
45uniqueintegration/configlegs completed inner/outer0, reaper4/docs4/138routes0.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved,
not uninterrupted. No app/test edits after native. Bundle573.51kBvs500warning
(previous573.12). Docker static only/no daemon execution claim. Coverage22FULL/
7PARTIAL/1MISSING/defaultOFF unchanged; no remote/baseline advance/accepted sync/
enabledworker. Existing report snapshot/window caveats unchanged.

Chronology: first combined A+B120s hit limit during migration after19legs0 and
review startup1/0checks. Review PG55456 bind failed twice despite closed TCPprobe;
same source with only temporary PG55537 substitution passed34/0, file removed.
Later standard review55456 also passed34/0. Clean A and rest reruns outer0.
First alternate-review+syncbrowser120s interrupted browser after review34/0;
no browser FAIL before interruption. Own Chrome4962/crashhandlers stopped; PG4845
zombie/TCP55479closed verified before removing own stale test socket/lock.
Isolatedbrowser239 inner/outer0. No external writes affected.
