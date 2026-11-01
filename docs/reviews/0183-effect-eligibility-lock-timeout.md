# 0183 - Bound effect eligibility lock waits

## Developer pass
SET LOCAL lock_timeout=2s after Serializable isolation check and before intent/
project/member/target/key/translation locks. Same helper used by runner and handler
revalidation,including webhook socket guards. Timeout aborts validation;runner
existing retry path requeues without invoking handler. No network under locks.
Per-lock bound,not cumulative validation/claim/settlement/transport/tick bound.
No lease renewal or automatic transaction retry added.

## Product pass
Contention no longer consumes unbounded individual eligibility lock waits. Existing
bounded attempts/backoff/dead semantics retained. Retry remains bookkeeping,not
delivery/sync acceptance. README/plan state precise limitations. DefaultOFF unchanged,
no production settings/data action,remote write,baseline advance,accepted sync or
external acceptance.22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI change. Actual480x900 effect summary pixels inspected:counts/timestamps/full
notice readable,separate actions,no horizontal overflow. Browser117 retained actual
pointer-driven summary load/refresh/error/navigation and local apply flows. Existing
scrolled target heading near sticky header;summary content itself complete.

## Security pass
Timeout never bypasses eligibility or authorizes delivery. Failed validation does
not invoke handler;no private error is returned to public UI or stored in queue.
SET LOCAL does not leak into pooled connections. No credential scope,spend,
registration,license or audience changes. Current-scope post-check race and
at-least-once effect/checkpoint crash gaps remain explicitly unresolved.

## QA/integration pass
Sync319->323:separate real PG project-row and translation-row blockers held throughout
runner execution. Captures actual P2010/meta55P03,elapsed2006/2008ms,zero handler calls,
pending state/attempt1;after release,due retry recovers completed. Initial project-only
321RC0,expanded final323RC0. Existing handler-after-lock-release test retained.
No failures,startup issues,timeouts or interruption117.

Final43integration/config legs14completed fail-closed batches,all individual+outer
RC0. API248/30,web55/7,both builds,reaper4RC0. Migration13,sync323,browser117,
automation123,webhook45. Native staged116+128=244total/242unique,all242literal
source labels covered,inner+outerRC0,checkpoint removed;not uninterrupted. No app
changes after final broad verification,only this review added afterwards.
