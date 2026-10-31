# 0141 - Isolated existing-key locale-set writer

## Developer pass
Internal helper validates locked preconditions under Serializable, validates entire
batch before mutation, supports existing-key locale sets only. Rejects unknown
keys/removal/duplicates/no-op/expected-value mismatch/length violation. Version
increments, row identity preserved, new absent locale row version1, review resets,
MT provenance clears, history/activity same transaction. No public route or
production caller. No hidden empty-string replacement for removal.

## Product pass
Transactional groundwork, not completed sync. Removal refused because current
translation deletion cascades history; durable deletion audit still needed.
Remote-only key creation, TM updates, webhook/automation delivery and target/
baseline authorization remain integration work before exposing any apply path.
No repository write/baseline advance. Coverage22FULL/7PARTIAL/1MISSING unchanged.
No external acceptance.

## Designer pass
No UI change/new screenshot. Existing local-change review UI98 checks retained.
README/plan accurately mark helper isolated, unsupported removal and missing
integration responsibilities. No apply controls or success claims added.

## Security pass
No HTTP caller can invoke writer or supply arbitrary evidence. Eventual caller
must authorize actor/target/baseline and bind reviewed draft in same transaction.
Whole-batch validation precedes writes, full rollback protects data/history/audit.
Other locales and project keys unchanged. Length limits enforced. No credential
scope expansion/enrollment/spend/license choice.

## QA/integration pass
Sync168->177 real PG: exact committed value/version/rowId, review/MT reset,
history/activity, other-locale/key/baseline preservation, removal/unknown/duplicate/
no-op refusal, invalid later operation cannot partially write, length rejection,
post-write error rolls back value/history/activity, absent row empty text creation.
Initial API build failed .ts runtime import extension; application import corrected
and fixture bundles actual source via bounded synchronous CLI. In-process bundler
left child cleanup noise after passing checks, even after stop(); replaced CLI,
clean final outerRC0. Repeated affected batches clean, not counted from noisy runs.
API248/30,web48/7,both builds,reaper4 RC0.43 distinct integration/config legs in13
completed clean fail-closed batches all individual/outerRC0;48 inventory legs.
Native visual116+128=244/two repeated startups/242 unique,every source label
covered,both inner/outerRC0,checkpoint removed. TM15442/visual15434 test ports,
staged not uninterrupted. No host interruption. No active services retained.
