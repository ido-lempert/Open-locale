# 0265 - Report project ID validation

## Developer review
All four report handlers now use Nest ParseUUIDPipe for projectId. Malformed IDs
stop before report service/Prisma calls. Existing valid project resolution and
report semantics unchanged. OpenAPI usage description records UUID boundary.

## Product review
Authenticated malformed IDs yield400 rather than an accidental database error.
Valid unavailable projects remain404. Anonymous malformed requests remain401;
authentication is not skipped by input validation. No UI/schema/route additions.
Coverage22 FULL/7 PARTIAL/1 MISSING/defaultOFF unchanged.

## Designer review
No UI changes. Fresh480x900 local actor/task fixture inspected: full actor IDs,
group/user/null rows readable, existing progress horizontal scrolling unchanged.
Screenshot is not malformed-input proof; actualHTTP tests establish response codes.

## Security review
Guard remains before parameter pipes. UUID validation is input hygiene, not
project authorization. Existing getFor still checks access. Error responses tested
for no Prisma string; no claim that all possible private diagnostics are scrubbed.
No new effects, credentials, accounts or audience.

## QA/integration review
Reports57->69: each of four endpoints malformed400/noPrisma,validunknown404,and
anonymousmalformed401. API262/31 and web146/9 uncached unchanged.43unique legs in12
fullycompletedgreenbatches,individual/inner/outerRC0. Sync644/browser212/builds/
reaper4/docs4/138routes0. No failures/startupissues/timeouts/interruption/targeted
negativecontrol. Web562.75kBvs500warning remains. NativeSTAGED116+128=244total/
242unique PG55534innerouter0/checkpointremoved,NOTuninterrupted. Noapp/testchanges
after native. No snapshot consistency or product parity claim.
