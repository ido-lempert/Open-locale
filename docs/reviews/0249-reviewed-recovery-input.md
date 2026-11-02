# 0249 - Reviewed recovery input preparation guard

## Developer pass
Pure helper validates required scalar shapes before retaining recovery input:
UUID,timestamp parse and shape,positive32bit revisions,hex digests/SHA,branch and
locale bounds. Repository target ID/revision/local branch/locale must match selected
configuration. Exact required fields only projected. Unknown/object type guards
use bracket access required by Angular production config. No API/server change.

## Product pass
A valid available value can remain read-only when execution bindings are absent
or malformed. No Prepare/Confirm and no send then. Normal valid review/recovery
unchanged. Server still revalidates authority/current state. No remote write,
baseline advance,accepted sync,enabled worker or retry. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged. This is not response authentication.

## Designer pass
Final480x900local injected incomplete-binding screenshot inspected:full review
notice,path/time,value,Hide and focus outline readable;no Prepare/Confirm,no
horizontal overflow;lower audit below. Normal controls unchanged. Screenshot
proves rendered read-only state,unit assertions prove omitted execution input.

## Security pass
Do not create an execution affordance from truthy binding objects. Reject missing,
wrong-typed,out-of-range,mismatched bindings;extra raw fields discarded. Value
availability/size remains separate. Server checks remain necessary,client is not
authority or freshness proof. No preparse/network memory erasure claims or targeted
negative-control claim. No secrets/grants/accounts changed.

## QA/integration pass
Web109/7->128/8(+18helper cases+1componentguard),API248/30 unchanged,uncachedRC0.
Browser196->197(+1available value with incomplete binding stays read-only),initial
and finalRC0. Final browser covers bracket-access helper.43unique integration/
config legs in12completed green batches,individual/outerRC0. Sync644,builds API/web,
reaper4,docs4/138routesRC0. Web budget warning559.60kBvs500kB persists.

Failure chronology:added component unit initially called nonexistent method,
127pass/1fail;fixed test to real recoverLocalValue/APIspy,128green. Tightening helper
from any to unknown introduced AngularTS4111dotted-index-access build error,
Jest still128green. OIDCbrowser1pass/1FAILweb-not-ready;combined call120stimeout
interrupted next linkfixture. Uncached build identifiedTS4111;fixed bracket access.
Identified interrupted webgroup6402 stopped;PG55480lockPID6333zombie/TCPclosed,
removed only orphanfiles. Build and splitOIDC49/link12/SAMLlink55/SAML61green.
First native pair inner116/128green but second+build+reaper combined120stimeout
lost outer status,empty reaper output. No live descendants/checkpoint. Re-ran API
build/reaper4 and whole native pair isolated:inner/outerRC0,116+128=244total/
242unique,PG55534,checkpointremoved. STAGED,not uninterrupted. No app/test changes
after final native stages;docs only. No external delivery/exactly-once claim.
