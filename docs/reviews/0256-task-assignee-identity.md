# 0256 - Task report assignee identity

## Developer pass
Group open task workload by nullableassigneeId,not displayName. Return additive
assigneeId per row,sort count descending then ID for ties. Same names and null
bucket no longer merge. UI tracks ID and shows full identity cue/Noassignee.
No schema migration,authentication or route change.

## Product pass
Distinct people with same name must not appear as one person's workload. Person
named unassigned remains distinct from nullassignment. Counts reconcile to open
plus inprogress. Group-assigned tasks with nulluser remain existing nullbucket;
separate group workload breakdown not added. Coverage22FULL/7PARTIAL/1MISSING/
defaultOFF unchanged,no repositoryeffect change.

## Designer pass
Final480x900localfixture inspected:two Sameassignee rows with distinct fullIDs,
nullbucket Noassignee,eachcount1 readable. IDs wrap within cell,tablefits viewport.
Existing progress table scroll unchanged. Identitycue is intentionally explicit,
not shortened ID ambiguity. No new actioncontrol.

## Security pass
AdditiveID uses same project-authorized task assignee identities already exposed
by task reads. No email/password or new access scope. Names escaped by Angular.
No real external accounts created;localfixture users only. No targetednegative
control/externaldelivery/exactly-once claim.

## QA/integration pass
ReportsHTTP27->30(+3same-name/nullcollision/reconcile),browser209->210(+1actual
same-nameidentityrows/nullbucket),initial/finalRC0. Uncachedweb146/9 API248/30,
bothbuilds/reaper4/docs4/138routesRC0.43uniqueintegration/configlegs in12completed
greenbatches,individual/outerRC0,sync644. InitialbatchbRC1:tagszero-checkstartup
port55436addressinuse;isolatedtags9thenfullbatchbgreen,no processkilled/sourcefix.
No timeout/interruption190. Webbudget562.62kBvs500warning. NativeSTAGED116+128=
244total/242unique,PG55534inner/outerRC0,checkpointremoved,not uninterrupted. No
app/testchangesafternative;API/browser210/fullbatchbreran,then docs only.
