# 0274 - Empty activity action table

## Developer review
Angular empty branch renders a two-column row when actionRows is empty. Existing
tables/selectors retained. Browser reloads real zero-event project before adding
null-actor activity; the action placeholder must disappear when event exists.

## Product review
No activity differs from no attributed actors. Zero-event view now explicitly
states no activity; null-actor-only activity still shows action/count and empty
actor explanation. No API/query/schema changes. Coverage22 FULL/7 PARTIAL/
1 MISSING/defaultOFF unchanged.

## Designer review
Fresh480x900 fullpage inspected: separate action/actor empty messages, captured
window, zero-task summary readable/fits. Existing progress horizontal scrolling
retained. No fabricated count or actor rows.

## Security review
Fixed static message, no new fields or disclosure audience. Existing authorization
and escaped interpolation unchanged. No cache/memory erasure or snapshot claim.

## QA/integration review
Browser215->217: realzeroevents/keys0/oneemptyactionrow+emptyactors,then realnull
actor event removes no-activity placeholder. Existing actor fixture remainsgreen.
Reports114/API265/31/web146/9uncached unchanged.43uniquelegs/12completedgreenbatches
individualinnerouter0;sync644/builds/reaper4/docs4/138routes0. No failures/startup/
timeouts/interruption/negativecontrol. WebwarningNOW563.34kBvs500(was563.20).
NativeSTAGED116+128=244total/242unique PG55534innerouter0/checkpointremoved,
NOTuninterrupted. Noapp/testchangesafter native;browser217reranafterward.
