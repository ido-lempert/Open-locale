# Glossary reset browser harness fails closed

## Developer review
Only glossary-new-term-reset-browser-test.mjs terminal accounting changes:
completed flag set after all healthy-path assertions, catch increments failures,
terminal exit uses those owned values. Synchronous exit handler forces failure
when incomplete or failed, including unresolved cleanup awaits after failed
PostgreSQL startup. Fixture-only environment port override enables an isolated
occupied-port probe with kernel-selected port. Default55742 unchanged. No app,
API, schema, dependency or database-content change.

## Product review
462 caught two misleadingRC0 startup aborts; neither was accepted as green.
This closes that concrete verification hole, not a new user feature or external
acceptance. Similar legacy patterns elsewhere remain outside this bounded fix.
A successful run still requires actual application assertions, not an exit code
alone. No promise that all browser harnesses now fail closed.

## Design review
No UI/layout/style change. Existing healthy glossary reset flow still checks
390px layout and screenshots; this slice does not claim a new visual design.

## Security review
Loopback-only controlled occupied port; no external receiver/account/worker,
credential, license, spend or permission change. Probe prints subprocess fixture
output only on failure, no user secrets. Existing process reaper wraps child and
probe, no unrelated process is killed. Failure status cannot be promoted by
PostgreSQL shutdown or an empty event loop.

## QA/integration review
First terminal-only attempt probe2PASS1FAIL because incomplete cleanup never
reached final exit. Added exit handler; fixed3/0. Intentional original harness
with only configurable port adapter:2PASS1FAIL, childRC0 despite actual occupied
PostgreSQL port/startup abort/noPASS. Restored3/0. Healthy real browser suite12/0
RC0, assertions unchanged, real lost-create/retained-draft/reuse/departed cases.
Probe asserts real EADDRINUSE and suite abort, nonzero unsignaled child exit, no
application PASS. No stubbed database/browser or weakened timing/assertions.
Broad application regression is the completed462 baseline; no app source changed.
Temporary actual-browser assertion-failure discriminator replaced only the390px
check with deliberate false:11PASS1FAIL/RC1, full remaining flow executed; temporary
variant removed. Current healthy source unchanged. Config16/14,docs4,reaper4 all0;
full web1563/153/API265/31 unit targets both cached0 and production builds both
cached0. No broad API/native/155-suite sweep rerun for this test-only fix;462 is
explicit preceding application baseline, not a new463 full-regression claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/externalacceptancegaps unchanged.
