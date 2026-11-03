# 0267 - Task status and deadline summary in one statement

## Developer review
Replaced status groupBy and two deadline count queries with one parameterized
PostgreSQL aggregate using FILTER. Status counts and overdue/dueSoon now share a
statement snapshot and captured now/in7 values. Workload grouping remains a
separate query, so this is not whole-report snapshot consistency. Output unchanged.

## Product review
Overdue excludesDONE and uses dueDate<now. Due soon excludesDONE and includes now
through now+7days. Null/later dates excluded. OPEN/IN_PROGRESS/DONE and total keep
existing numeric API contract. No UI/schema/route/auth changes. Coverage22 FULL/
7 PARTIAL/1 MISSING/defaultOFF unchanged.

## Designer review
Fresh480x900 local actor/task fixture inspected: unchanged task summary and
identity rows readable; existing progress horizontal scrolling retained. Image
is not deadline-count proof; actualPGHTTP fixtures and unit query checks are.

## Security review
Authorization remains before bound SQL. One statement reduces inter-count drift,
not authorization staleness or clock trust risk. No DB timeout/resourcebound,
transaction-wide snapshot, cache erasure or new audience claim.

## QA/integration review
Reports77->79 actual6-taskfixture:3OPEN/1IN_PROGRESS/2DONE,total6,overdue1,dueSoon1;
null/later/DONE date cases excluded;openworkload4 reconciles staticfixture. API262->
263/31 unit sharedclock/+7days/parameterproject/no old count queries. Exactboundary
inclusion is query-shape evidence, not frozen-clockHTTP;actualHTTP uses past/3days/
9days. Web146/9 unchanged.43unique legs in12 completedgreenbatches individual/
inner/outerRC0. Sync644/browser212/builds/reaper4/docs4/138routes0. No failures/
startupissues/timeouts/interruption/targetednegativecontrol. Web562.75kBvs500warning.
NativeSTAGED116+128=244total/242unique PG55534innerouter0/checkpointremoved,
NOTuninterrupted. Noapp/testchangesafter native.
