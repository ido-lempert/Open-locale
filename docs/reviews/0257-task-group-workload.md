# 0257 - Task report group workload identity

## Developer pass
Select assigned group and groupname;workload buckets keyed by kind+stableID.
Additive kind/assigneeGroupId fields distinguish user/group/unassigned;each open
task counts once. UItrack includes kind and ID,Groupprefix identifies group cue.
No schema/route/auth changes. If privileged invalidrow has bothIDs,user wins;
normal task writes already reject dualassignment.

## Product pass
Groupassigned is not unassigned. Same-name group/person/nullbucket remain separate.
Group workload not expanded across members;not per-member capacity assignment.
Supersedes190'sstatedgroup-nullbucketlimitation. Deletedgroup relation still SETNULL,
so task becomes unassigned as normal lifecycle. Coverage22FULL/7PARTIAL/1MISSING/
defaultOFF unchanged,no repositoryeffects changed.

## Designer pass
Final480x900localfixture inspected:GroupIDcue,twosame-nameuserIDs/nullNoassignee,
allfourcounts1readable/tablefits. FullIDsavoidtruncationambiguity. Existingprogress
scroll/layout unchanged. Image initial/finalread eachTLSfailedonce,retry inspected.

## Security pass
Projectreadscope unchanged;groupID/name already on taskreads. No emails/secrets,
externalaccounts/grants. Angular escapes names. No targetednegativecontrol or
externaldelivery/exactly-once claim.

## QA/integration pass
ReportsHTTP30->32(+2group/user/nullreconcile),browser210->211(+1groupcue),initial/
finalRC0. Uncachedweb146/9 API248/30,bothbuilds/reaper4/docs4/138routesRC0.43unique
integration/configlegs in12completedgreenbatches,individual/outerRC0,sync644.
Initialpermissionszero-checkTCP55454addressinuse twice;mergeconcurrencyzero-check
TCP55464once. C1/c2batchRC1correctlyrejected. No livePG/socketfilesfound;no process
killed/sourcefix. Laterisolated50/7thenwholec1/c2green. No timeouts/interruption191.
Webbudget562.70kBvs500warning. NativeSTAGED116+128=244total/242unique,PG55534inner/
outerRC0,checkpointremoved,not uninterrupted. No app/testchangesafternative;API/
browser211/c1/c2reran,then docsonly.
