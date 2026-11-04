# 0304 - Task Activity change shapes

## Developer review
Task detail requires a non-array change map and non-array object pairs with both
valid values. Existing server string/null/boolean/string-array values preserved.
Malformed entries skipped independently; valid neighbors survive. Nonstring title
omitted. Three units cover containers, pair shapes, malformed values and valid
assignee/lock/key/date/null summaries. No API/query/schema change.

## Product review
Malformed snapshots no longer show numbered characters, undefined values or object
coercions as task changes. Existing title retained when change map incomplete;
missing title does not add a leading separator. No missing-data inference or new
field lookup. Other audit formats not claimed fully hardened.

## Designer review
Fresh480x900 task-update capture inspected: mixed valid status/lock summary wraps
readably, malformed-only row retains title; actor/action/timestamps and controls
fit. No layout change or new overflow.

## Security review
Shape checks avoid arbitrary object coercion/join. Angular interpolation unchanged;
no HTML binding, new backend fields, credential scope, spend, license or provider
request. Local persisted malformed/mixed fixtures verify invalid markers absent,
valid neighboring details present. Owner original upload authority recovered.

## QA/integration review
API265/31/web192->195/11 uncached0/builds0. Activity20->21 actual invalid/mixed task
snapshot check; reports118/sync644/syncbrowser239/QA14 unchanged.45uniqueintegration/
configlegs inner/outer0; reaper4/docs4/138routes0. No failures/timeouts/interruption.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved,
not uninterrupted. No app/test edits after native. Bundle574.03kBvs500warning
(previous573.75). Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no remote/baseline advance/accepted sync/enabledworker.
Existing report snapshot/window caveats unchanged.
