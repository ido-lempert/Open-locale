# 0246 - Denied archived review discards private response value

## Developer pass
Client projection now stores null value when reviewAvailable is false,even if
inconsistent response carries private bytes. Existing recovery binding extraction
already requires available review. Both target and value-only unit fixtures include
denied value+bindings and assert none retained. No API/server change;normal server
already returns null on denial.

## Product pass
Defense-in-depth privacy boundary,not a newly denied feature. Valid available
review and current fixed reason guidance unchanged. No automatic recovery/retry,
remote write,baseline advance,accepted sync or enabled worker.22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged.

## Designer pass
Actual480x900 existing-value-denial screenshot inspected after final run. Fixed
notice/path/snapshot/hide control readable,no private value or prepare/confirm,
focused region visible,no horizontal overflow. Lower audit continues below viewport.
Normal visible behavior unchanged;image does not prove internal state discard,
unit assertions do. Fixture data only.

## Security pass
Do not retain denied private payload merely because template hides it. Required
binding extraction still unavailable on denial. Unit state serialization excludes
sentinel bytes/digest/SHA in both review modes. Browser inconsistent200denied
response includes sentinel value/bindings,asserts no private rendering/control.
No erasure guarantee for network response or JS runtime memory. No new grant/API,
no targeted negative-control claim.

## QA/integration pass
Web104->106/7(+2target/value-only denied state cases),API248/30 unchanged. Browser
190->191(+1inconsistent denied-response check),initial/finalRC0.43unique integration/
config legs in10completed green batches,individual/outerRC0. Sync644,builds API/web,
reaper4,docs4/138routesRC0. No failures,startup issues,timeouts/interruption180.
Existing~555kBvs500kB web budget warning persists. Native STAGED116+128=244total/
242unique supportedPG55534,inner/outerRC0,checkpoint removed,not uninterrupted.
No app/test changes afterward;web106/browser191reran,then docs only. No external
delivery or exactly-once claim.
