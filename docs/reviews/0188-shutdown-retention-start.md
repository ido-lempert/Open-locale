# 0188 - Do not start new retention during effect shutdown drain

## Developer pass
Due retention condition now also requires !stopped. Shutdown sets stopped before
awaiting shared inFlight,so an effect finishing during drain cannot launch new
cleanup from finally. Cleanup already in flight remains awaited. Independent flags,
cadence/nonoverlap unchanged. No hard shutdown deadline/transport cancellation.

## Product pass
Drain completes started work without adding new cleanup after shutdown begins.
DefaultOFF flags unchanged,no production settings/data action,remote write,baseline
advance,accepted sync or external acceptance. Long-running effects still delay
shutdown;forced kill can interrupt them.22FULL/7PARTIAL/1MISSING unchanged.
README/plan updated.

## Designer pass
No UI change. Actual480x900 summary pixels inspected:counts/checkpoints/timestamps
and full notice readable,separated actions,no horizontal overflow. Screenshot
starts at remote-branch metadata after scroll;whole summary visible. Browser118
retained real physical-pointer summary/apply flows.

## Security pass
No weakening of eligibility/lease/checkpoint logic. Shutdown does not claim cleanup
completed;terminal row remains for future process. No private payload/credentials
newly exposed. No spend,registration,license,audience or credential scope change.
At-least-once crash gaps unchanged.

## QA/integration pass
Automation131->132:existing actual held-socket lifecycle now enables both flags.
Shutdown waits while socket held;eligible terminal row seeded during shutdown.
After release,drain resolves and terminal remains untouched. Initial/final132RC0.
Existing actual Nest signal drain/retention-only/failing-effect cleanup tests remain.

Fixture startup failures:merge-concurrency55464address-in-use twice,0checksRC1;
reports55466address-in-use once,0checksRC1. Added optional harness port overrides
MERGE_CONCURRENCY_TEST_PG_PORT and REPORTS_TEST_PG_PORT. Entire e/f1batches rerun
15464/15466green7/27checks,individual+outerRC0. No production ports changed,app
assertion failure,timeouts or interrupted calls122.

Final43integration/config legs14completed fail-closed batches,all individual+outer
RC0. API248/30,web55/7,both builds,reaper4RC0. Migration13,sync327,browser118,
automation132,webhook45. Native staged116+128=244total/242unique,all242literal
source labels covered,inner+outerRC0,checkpoint removed;not uninterrupted. All app
changes preceded final broad verification;only this review added afterwards.
