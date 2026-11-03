# 0258 - Usage report window validation

## Developer pass
Controller validates supplied decimalintegertext before Numberconversion;service
rejects non-safe integers before activityqueries. Missing defaults30,finite safe
integers clamp1..90. Explicit0now1,instead of oldfalsydefault30. OpenAPIdescription
updated. No route/schema/auth change. Leadingzeros accepted,whitespace/exponent/
fraction/infinity/empty rejected.

## Product pass
Malformed window is400,not silentdefault or invaliddate500. Current UI default
usage unchanged. Negativeinteger stillclamps1,large safeintegerclamps90. No new
UIcontrol or provider/spending decision. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF
unchanged. No repositoryeffects changed.

## Designer pass
No UIchange. Final480x900existinggroupidentityreportfixtureinspected:default30days
usage and taskrowsreadable,existingtablescrollunchanged. Image not inputvalidation
proof;actualHTTPtests establish malformed400/default/clamp behavior.

## Security pass
Reject malformed/unsafe query at controller;directservicealso guards numericinput.
No rawinputecho or new disclosure. Authguardstillapplies;service projectaccesscheck
precedes numericguard. No targetednegativecontrol/externaldelivery/exactlyonceclaim.

## QA/integration pass
API248/30->259/31(+11numeric/default/clampunits),web146/9unchanged,uncachedRC0.
ReportsHTTP32->41(+8malformed400+zero/negativeclamp),browser211unchangedRC0.
InitialnewunitimportcontrollerpulledJWTESMdependency,1suitecompilefailure/248existing
pass. Removedcontrollertestcoupling;serviceunits+realHTTPcoverboundary,259green.
No productionfixforharnessissue.43uniqueintegration/configlegs in12completedgreen
batches,individual/outerRC0,sync644,bothbuilds/reaper4/docs4/138routesRC0. No startup/
timeout/interruption192. Web562.70kBvs500warning. NativeSTAGED116+128=244total/
242unique,PG55534inner/outerRC0,checkpointremoved,not uninterrupted. No app/test
changesafternative;browser211reran,then docsonly.
