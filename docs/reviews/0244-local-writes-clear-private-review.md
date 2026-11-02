# 0244 - Local baseline/apply writes clear private recovery review

## Developer pass
Accepted baseline and local apply now invoke shared private-review cleanup after
their action guards,before await. Captured snapshot/draft inputs remain intact;
review target/loading/private value+bindings/eligibility clear. Unconfirmed calls
remain no-ops. Unit success and unknown failure cases cover both mutations.

## Product pass
Changing comparison baseline or local values requires fresh archived recovery
review,not retained prepared confirmation. Actual baseline acceptance browser
coverage binds prior prepared recovery and verifies baseline version+1 without
recovering value/history/intent. Local apply cleanup is unit-tested here,not a new
actual-browser coexisting-review/apply claim. No remote write or accepted sync,
worker staysOFF. Baseline acceptance is comparison-only,not remote sync acceptance.
22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
Actual480x900 baseline-accepted/cleared-review screenshot inspected twice including
final. Full success/no-import/no-repository-write notice,refresh/audit controls and
reset value-only scope readable. No private archived value/recovery controls;
metadata card continues below viewport,no horizontal overflow visible. Local fixture.
No new visual layout beyond cleared review.

## Security pass
Old prepared recovery must not survive local mutation start even if result unknown.
Shared cleanup does not widen authority or send recovery. Browser holds actual
baseline POST,asserts private clearing before response;real committed baseline
version increments,deleted locale remains absent,no history/queue delta. Existing
server stale checks unchanged,no new grants/API/targeted negative control.

## QA/integration pass
Web101->104/7(+3parameterizedsuccess/failure/guard cases),API248/30 unchanged. Browser
186->188(+2actual baseline-write boundary checks). Initial browser zero-check syntax
failure:duplicate acceptanceGate fixture identifier,renamed isolated variables.
Full188green twice afterward,web104finalRC0. No application assertion failure,
startup issue,timeout or interrupted call178. Zero-check failure not counted green.
43unique integration/config legs in10completed green batches,individual/outerRC0.
Sync644,builds API/web,reaper4,docs4/138routesRC0. Existing~555kBvs500kB web budget
warning persists. Native STAGED116+128=244total/242unique supportedPG55534,inner/outer
RC0,checkpoint removed,not uninterrupted. No app/test changes afterward;web104/
browser188reran,then docs only. No external delivery or exactly-once claim.
