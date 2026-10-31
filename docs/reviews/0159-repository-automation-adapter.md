# 0159 - Internal repository automation adapter

## Developer pass
Adapter re-reads current leased intent in a short Serializable eligibility
transaction, then calls existing automation service outside DB locks with exact
project/key/branch/locale/actor context. Failed aggregate throws a generic error.
No channel checkpoint, queue step, worker or timer added. Actual DB task/activity
creation tested through bundled adapter/service dependencies, not an adapter mock.

## Product pass
Empty-string sets follow normal value-write semantics; removal returns skipped
without inventing a value trigger. Existing main/base-locale bounds retained.
This is internal groundwork, not public repository execution or combined channel
completion. Per-rule retry deduplication is still needed: partial effects may
already happen before aggregate/activity failure. No exactly-once claim, baseline
advance, remote write or external acceptance. Coverage22FULL/7PARTIAL/1MISSING.

## Designer pass
No UI or new controls. README/plan describe the internal boundary and remaining
retry work. Existing browser98 and native editor screenshot retained; no claim
that this slice adds a visual feature. Inspected current 1280x800 editor pixels:
locale columns, saved marker and memory suggestion readable without overlap.

## Security pass
Current actor admin/target revision/key/locale/value generation/lease validated
before dispatch. Existing creator permission checks retained by service. This is
a point-in-time check, not elimination of post-check races. No locks held across
automation effects. Generic aggregate failure exposes no new raw error payload.
No external registration, credential scope, spend, license or audience changes.

## QA/integration pass
Automations35->42: actual task/activity and actor/runAs; changed target denies
before activity; failed rule aggregate propagates (explicit notify failure double,
not external receiver acceptance); removal skipped; empty set actual task; nonbase
locale skipped. Existing real local notify receiver tests retained. Initial40
checks then final42 after empty/nonbase coverage added; no failing test run93.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs in14 clean
fail-closed batches, all individual/outerRC0;48 inventory. Webhook45,sync268,
sync-browser98. Native visual116+128=244 total/242 unique,all242 literal source
labels covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted.
No host interruption93. No active fixture services/temp bundles after completion.
