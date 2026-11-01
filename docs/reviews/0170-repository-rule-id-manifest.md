# 0170 - Freeze repository automation rule IDs

## Developer pass
First set-value automation dispatch validates/locks current intent in Serializable
transaction then persists eligible rule IDs. Nullable JSON distinguishes absent
manifest from empty selection. Later dispatch reuses ID set;ordinary callers omit
filter. Existing guards/ledger retained. Additive migration/generated client/build/
full deployment checked. Malformed nonarray/nonstring manifest fails closed.

## Product pass
New rules cannot join same intent on partial retry. This freezes IDs,not config:
selected failed rules use current config on a later retry;deleted/disabled selected
rules are omitted by current enabled query. Completed IDs still skipped by ledger.
No production timer/public apply/baseline advance/remote write/external acceptance.
Crash gaps remain;22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI. Current native1280x800 editor screenshot inspected: readable locale columns,
saved state/memory suggestion without overlap. Existing UI evidence,not new feature.
README/plan distinguish frozen IDs from frozen configuration.

## Security pass
Manifest selection and write share current-intent row lock/Serializable scope,
not external execution grant. Per-rule current authority/config revision and
per-socket/MT guards remain. No locks across effects/network. No registration/
credential scope/spend/license/audience change.

## QA/integration pass
Automation101->102: actual partial failure freezes two IDs;new actual task rule
created between attempts excluded from persisted manifest and retry creates no
late-rule task. Earlier closed/edited completed rule remains skipped and failed
selected rule recovers. Independent fixture scenarios clear manifest alongside
ledger resets,not between partial attempts. Existing failure doubles labeled.
API248/30,web48/7,both builds,reaper4RC0.43integration/config legs14clean fail-closed
batches,all individual/outerRC0;48inventory. Webhook45,migration10,sync268/browser98.
Native116+128=244total/242unique,all242literal source labels covered,inner/outerRC0,
checkpoint removed. Staged,not uninterrupted. No failing test/host interruption104.
No active fixture services/temp bundles on completion.
