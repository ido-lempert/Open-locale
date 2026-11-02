# 0232 - Recovery HTTP rejects committed post-review changes

## Developer pass
Tests only. Five real database mutations commit after target-scoped review and
before actual recovery HTTP POST. Compare complete pre-execution recovery counts,
row,key,target,baseline,marker and archive to post-denial state. Fixture cleanup
restores target/baseline/generation and removes created value;key metadata reset
still advances database revision,so explicitly obtain a fresh review for later
independent cases. No weakening of database-owned key revision.

## Product pass
Actual changed state,not only forged stale request fields:target revision,
baseline version,key revision,deletion generation and existing locale value each
reject409 without silently refreshing the reviewed request. No new app behavior,
UI,remote work or worker change. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF.

## Designer pass
No UI change. Actual480x900 screenshot inspected:focused read-only review,target/
path/UTC/no-reservation/no-restore-UI notice,escaped value/controls readable,no
horizontal overflow. First heading partly behind sticky header,second card below
viewport. Screenshot does not exercise mutation.

## Security pass
Five public-route checks preserve exact committed state on denial. Existing value
cannot be overwritten and newer deletion generation cannot be consumed by older
review. Guards unchanged. Negative attempt removed shared baseline-version check:
274pass/12fail then early suite abort before these HTTP cases due consequential
fixture corruption. This negative is NOT discriminating evidence for the new
checks. Source restored/rebuilt;full636green. No claim of targeted-negative proof.

## QA/integration pass
Sync631->636(+5committed-state HTTP cases),initial/finalRC0.43unique integration/
config legs in11completed green batches,individual/outerRC0. Browser156,
API248/30,web77/7,both builds,reaper4,138routes allRC0. Migration22,
automation132,webhook45. No startup issues,timeouts/interrupted calls or unrelated
failures. Native staged visual116+128=244total/242unique,all242literal labels
present,inner/outerRC0,checkpoint removed. Staged,not uninterrupted. Only docs
changed after final integrations;docs/API build rechecked precommit. No external
acceptance claim.
