# 0259 - Usage top actor identity

## Developer pass
Usage already aggregates by actorID,but response droppedID and UItrackedname.
Return additive actorId,deterministic countdescending/IDascending tieorder before
limit5. UItracksID and renders fullIDcue. Taskidentityunchanged. No schema/route/
authchange.

## Product pass
Same-name actors remain distinguishable with own eventcounts,not merged or
ambiguous trackedrows. Top5stillnot allactors;nullactor events counted in total/
actions but excluded from topactors asbefore. Coverage22FULL/7PARTIAL/1MISSING/
defaultOFF unchanged,no repositoryeffect changes.

## Designer pass
Final480x900localfixture inspected:twosame-nameactorrows/distinctfullIDs/count1,
usage2events/1key,taskrowsretained. IDsreadable/tablefits;existingprogressscroll
unchanged. No emailornewactioncontrol. Longnamesstillnormalescapedtext.

## Security pass
ActorIDalreadypresent inprojectactivityreads;projectreadscopeunchanged. Removed
unusedemailselection not partofthisslice. No newauthority/secrets/externalaccounts.
No targetednegativecontrol/externaldelivery/exactlyonceclaim.

## QA/integration pass
ReportsHTTP41->43(+2same-nameactors/owncounts+tieorder),browser211->212(+1actual
actoridentityrows),initial/finalRC0. Uncachedweb146/9 API259/31,bothbuilds/reaper4/
docs4/138routesRC0.43uniqueintegration/configlegs in12completedgreenbatches,
individual/outerRC0,sync644. No testfailures/startup/timeouts/interruption193.
InitialcombinedshelloverallRC1onlyfinalgrepFAILnomatches;individualbuilds/reports
RC0,not failedsuite. Web562.75kBvs500warning. NativeSTAGED116+128=244total/242unique,
PG55534inner/outerRC0,checkpointremoved,not uninterrupted. No app/testchangesafter
native;API/browser212reran,then docsonly.
