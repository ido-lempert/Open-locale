# 0179 - Separate opt-in terminal retention

## Developer pass
Single existing5sec timer now starts when either exact deployment flag true.
Dispatch and retention flags captured independently at init. Retention-only never
calls effect step. Cleanup due at first tick,then no sooner than60sec after attempt;
sets deadline before call so failure cannot cause5sec retry loop. Shared inFlight
nonoverlap and shutdown drain. Existing prune bounds100old terminal rows/call.
Effect step precedes cleanup when both enabled;failure/long work may defer cleanup.
No hard real-time retention promise or global100/min cap across processes.

## Product pass
Separate REPOSITORY_EFFECT_RETENTION_ENABLED defaultOFF. Seven-day completed/dead
records plus rule checkpoints can be removed;pending/leased never age-pruned.
Retention alone does not dispatch. No deployment flags enabled outside local test
fixtures,no production data deleted. No remote writes/baseline advance/accepted sync/
external-account acceptance.22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI change. Current480x900 confirmation pixels inspected directly:scope,digest,
effect notice and separate actions readable,no overflow. Browser108 retains actual
apply/cancel/removal/navigation evidence. README states independent opt-in and
per-process bound rather than implying deletion is always running.

## Security pass
DefaultOFF avoids surprise retention. Existing prune uses DB wall clock and locked
terminal rows SKIP LOCKED,does not return private payload. Cascading successful-rule
checkpoints removed only with parent intent. No network side effect in retention.
No new credential/scope/spend/registration/license/audience changes.

## QA/integration pass
Automation116->123: actual105old terminal rows untouched defaultOFF;opt-in lifecycle
removes100only;actual checkpoint cascade;pending row remains pending/attempt0;next
5sec tick does not prune again;shutdown leaves new eligible terminal intact;actual
Nest child retention-only config deletes remaining terminal rows without claiming
pending. Existing actual signal drain/socket/task tests retained. Initial120,
expanded122,final123/full sweep123clean. No failures/interruption113.
API248/30,web52/7,both builds,reaper4RC0.43integration/config legs14completed
fail-closed batches,all individual/outerRC0;48inventory. Webhook45,migration10,
automation123,sync304/browser108. Native staged116+128=244total/242unique,all242literal
source labels covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted.
No live fixture services/temp bundles.
