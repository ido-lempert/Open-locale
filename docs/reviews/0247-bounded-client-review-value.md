# 0247 - Bounded client archived-review value

## Developer pass
Client available state now requires literal boolean true,string value and at most
32768UTF8bytes. Invalid claimed-available responses project null value,unavailable
state,fixed generic reason and no recovery bindings. Displayed maxValueBytes fixed
to32768,not provider-selected. Empty string and exact multibyte boundary accepted.
No API/server change;normal server already enforces same size.

## Product pass
Defensive consistency,not product scope growth. No value/prepare control for
malformed or oversized response even if provider says available. Valid review and
explicit confirmation flow unchanged. No remote write,baseline advance,accepted
sync,enabled worker or automatic retry.22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
Actual480x900invalid-response screenshot inspected twice including final. Full
fixed unavailable notice,target path,snapshot/limits,hide control readable inside
focused region,no value/prepare/confirm. Lower audit below viewport,no horizontal
overflow visible. Fixture image demonstrates rendered rejection,not component-state
proof;unit assertions establish state projection. Normal UI unchanged.

## Security pass
Do not rely on response truthiness/type metadata for private value display. Bounds
measure encoded UTF8bytes,not code units. Unit Hebrew32768accepted/32770denied,
empty accepted,object/null values and truthy string/number availability denied.
No recovery bindings retained for invalid values. Network response still exists;
not memory erasure or preparse network resource bound. No new grant/API,no targeted
negative-control claim.

## QA/integration pass
Web106->109/7(+3parameterizedboundary/malformed cases),API248/30 unchanged. Browser
191->192(+1oversized available fixture rejected/no controls),initial/finalRC0.
43unique integration/config legs in10completed green batches,individual/outerRC0.
Sync644,builds API/web,reaper4,docs4/138routesRC0. No failures,startup issues,timeouts
or interruption181. Existing~555kBvs500kB web budget warning persists. Native STAGED
116+128=244total/242unique supportedPG55534,inner/outerRC0,checkpoint removed,not
uninterrupted. No app/test changes afterward;web109/browser192reran,then docs only.
No external delivery or exactly-once claim.
