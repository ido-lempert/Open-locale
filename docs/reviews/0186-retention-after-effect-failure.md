# 0186 - Keep due retention independent of effect failure

## Developer pass
Run due retention in finally after optional effect step. Independent flags,shared
inFlight/nonoverlap/drain unchanged. Deadline set before cleanup attempt,so failed
effect cannot cause5sec cleanup retry. Long-running effect still defers finally;
no real-time retention guarantee. Both failures still reach generic worker warning;
cleanup failure can replace earlier error internally,no private text logged.

## Product pass
Separate opt-in retention should get its due attempt even if effect step fails.
No change to100old terminal rows/min/process or seven-day policy. Failed database
can still prevent cleanup. DefaultOFF unchanged,no production settings/data action,
remote write,baseline advance,accepted sync or external acceptance.
22FULL/7PARTIAL/1MISSING unchanged. README/plan updated with limitation.

## Designer pass
No UI change. Actual480x900 summary pixels inspected:counts/timestamps/full notices
readable,separate actions,no horizontal overflow. Scrolled target heading touches
sticky header,summary complete. Browser117 retained actual pointer flows.

## Security pass
No network work added,eligibility/lease guards unchanged. Cleanup still terminal
only,no pending claim or payload disclosure. Failing claim cannot authorize dispatch.
No raw injected/private error logged by worker. No credential scope,spend,
registration,license or audience change. At-least-once crash gaps remain.

## QA/integration pass
Automation129->131:worker real lifecycle with claim-only injected failure,actual
old terminal row removed by real Prisma prune,pending intent stays attempt0.
New eligible old row after first cleanup survives next5sec tick despite another
failed claim;exact two claim attempts. Initial/final standalone131RC0. Existing
actual socket/drain/Nest SIGTERM/retention-only tests retained. No failures,startup
issues,timeouts or interruption120.

Final43integration/config legs14completed fail-closed batches,all individual+outer
RC0. API248/30,web55/7,both builds,reaper4RC0. Migration13,sync326,browser117,
automation131,webhook45. Native staged116+128=244total/242unique,all242literal
source labels covered,inner+outerRC0,checkpoint removed;not uninterrupted. All app
changes preceded final broad verification;only this review added afterwards.
