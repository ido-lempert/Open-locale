# 0260 - Usage captured time bounds and UTC days

## Developer pass
CaptureasOfonce,sincefromsameclock,apply inclusivegte/lte filters to allactivity
aggregates. SQLUTCcalendarstring projection avoids DBtimezone-dependent daylabel.
Return additiveasOf/timezoneUTC;webtypeupdated,UIunchanged. Separatequeriesremain
separatesnapshots,not atomicallyconsistentreport.

## Product pass
Future-datedactivityexcludedfromtrailingwindow. DaybucketsUTCexplicit,not userlocal
calendar. Same30dayduration/default/validated1..90clamp. No newUIcontrol/action.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFFunchanged,no repositoryeffects changed.

## Designer pass
NoUIchange. Final480x900existingactorfixtureinspected:usage2events/identityrows/
taskrowsreadable,tablefits/existingprogressscrollunchanged. Image nottimeboundary
proof;actualPGfixtureestablishesUTC/futureexclusion.

## Security pass
Boundqueriesexclude future timestamps,not cryptographicclockvalidation. Normal
projectreadscopeunchanged. asOfmetadataiswindowcutoff,NOTDBsnapshot/authorization
freshnessproof. No targetednegativecontrol/externaldelivery/exactlyonceclaim.

## QA/integration pass
ReportsHTTP43->46(+3futureexcluded/allaggregatereconcile/UTCnonUTCDB/asOf),API259->
260/31(+1sharedboundsunit),web146/9unchanged,uncachedRC0. ActualPGdatabase default
America/Los_Angeles beforeAPIconnections;00:30UTCtwodaysagobucketscorrectUTCday,
future+1dayexcludedfromactions/daytotal/activekeys. asOf-sinceexact30days.
43uniqueintegration/configlegs in12completedgreenbatches,individual/outerRC0,
sync644/browser212,bothbuilds/reaper4/docs4/138routesRC0. No failures/startupissues/
timeouts/interruption194. Web562.75kBvs500warning. NativeSTAGED116+128=244total/
242unique,PG55534inner/outerRC0,checkpointremoved,not uninterrupted. No app/test
changesafternative;browser212reran,then docsonly.
