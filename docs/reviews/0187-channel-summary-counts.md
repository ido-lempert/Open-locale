# 0187 - Aggregate channel checkpoints in manual summary

## Developer pass
Single existing aggregate query adds webhookHandledAt/automationHandledAt/both
non-null counts across all scoped intent states. Safe-integer conversion and empty
zero behavior retained. No payload/individual row fetch. Typed client/UI extended.
Pending retry can already have webhook checkpoint,so counts are not state totals.
No new polling,mutation,dispatch or retry path.

## Product pass
Manual summary now distinguishes independent channel bookkeeping including partial
retry. Labels say checkpoints,notice explicitly not delivery receipts or completed
sync. Historical revisions and seven-day terminal retention caveats retained.
DefaultOFF unchanged,no production settings/data action,remote write,baseline
advance,accepted sync or external acceptance.22FULL/7PARTIAL/1MISSING unchanged.
README/plan/spec updated;route count133 unchanged.

## Designer pass
Actual desktop and480x900 pixels inspected:new labels/counts aligned and readable,
wrapped timestamp and full warning visible,no horizontal overflow,separate actions.
Narrow screenshot starts at remote-branch metadata after scrolling;whole summary
visible. No new visual issue found. Screenshots attached to parent.

## Security pass
Existing session-admin/project-target filtering and exact response whitelist remain.
Only aggregate counts added,no actor/token/key/value/raw error or private content.
Existing error clearing/navigation fences retained. No credential scope,spend,
registration,license or audience changes. Checkpoints never imply authority to act.

## QA/integration pass
Sync326->327:real mixed DB fixture has webhook-only pending,dual completed and
independent automation-only dead;counts2/2/1. Existing empty assertion expanded to
0/0/0,response whitelist updated;read-only and cross-project/target tests retained.
Browser117->118:actual pointer refresh displays seeded2/1/1 channel counts,claim
warning,no payload,480fit and stale/error/navigation tests retained. Web55/7 typed
lifecycle fixture updated,no new test count. Initial/final sync327/browser118RC0.
No failures,startup issues,timeouts or interruption121.

Final43integration/config legs14completed fail-closed batches,all individual+outer
RC0. API248/30,web55/7,both builds,reaper4RC0. Migration13,sync327,browser118,
automation131,webhook45. Native staged116+128=244total/242unique,all242literal
source labels covered,inner+outerRC0,checkpoint removed;not uninterrupted. All app
changes preceded final broad verification;only this review added afterwards.
