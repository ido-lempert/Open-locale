# 0240 - Actual configuration save and fresh recovery review

## Developer pass
Tests only. Browser prepares private recovery,edits path,holds actual PUT before
forwarding,and checks private review/confirmation gone and scope reset. Release
real PUT,verify committed path and revision+1,accepted baseline deleted,no locale/
history or queue change. Wait for explicit config GET response after test-fixture
restoration instead of an enabled DOM that may precede Angular rendering.

## Product pass
Closes the successful-save browser boundary explicitly unclaimed in review0239.
Fresh review with no baseline returns ordinary denied envelope,no value or prepare
button. Does not promise a fresh baseline was accepted by UI. Direct isolated
fixture path/baseline restoration is only setup for later independent recovery
scenarios;baseline targetRevision uses current committed target revision. No app
change,remote write/baseline advance/sync acceptance/worker enablement. Coverage
22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
Actual480x900 denied-review screenshot inspected,including final run. Full current
updated path,denial/snapshot/no-reservation notice and hide control visible inside
focused region. No private archived value or prepare/confirm controls. Lower audit
card continues below viewport,no horizontal overflow visible. Fixture data only.
No visual app behavior changed.

## Security pass
Actual authenticated local browser request changes configuration,not translations.
Exact DB assertions retain absence and zero history/queue delta. Fresh review fails
closed without baseline rather than reusing prior prepared binding. Test fixture
baseline replacement is not a product authorization route. No new grant/API or
negative-control claim.

## QA/integration pass
Browser176->179(+3held-save/committed-configuration/no-baseline fresh review). First
run143passes/one wait timeout expected alert but source returns ordinary denied
review envelope. Corrected fixture expectation. Second144passes/one wait timeout
at later restored review:baseline targetRevision made explicit and config refresh
now waits for actual GET response. Diagnostic direct review confirmed restored
fixture eligible;debug output removed. Full179green twice after final correction.
No app assertion failure,no execution-limit interruption/startup failure174.

Web93/7,API248/30 unchanged,RC0.43unique integration/config legs in10completed green
batches,individual/outerRC0. Sync644,builds API/web,reaper4,docs4/138routesRC0. Existing
~555kBvs500kB web warning persists. Native STAGED116+128=244total/242unique,inner/outer
RC0,checkpoint removed,not uninterrupted. No app/test changes after native stages;
web93/browser179reran,then docs only. No external exactly-once/delivery claim.
