# 0145 - Transactional translation memory for isolated locale writes

## Developer pass
Extracted normal editing/import rememberTx implementation into rememberValueTx,
keeping the same unique project/target/source-locale/source-text upsert and key
lineage. Isolated existing-key writer calls the helper inside its Serializable
transaction after local validation. Project base locale and source translation
are read in the same transaction. No duplicated TM behavior or extra transaction.

## Product pass
Nonempty target values remember current nonempty base source. Empty target/base
writes and missing/empty sources do not invent pairs. Removal preserves historical
TM, as normal editing does. Internal-only groundwork; no public apply, remote
write, baseline advance or successful-sync claim. Webhook/automation delivery and
fresh-source/session execution composition remain code work. Coverage stays
22FULL/7PARTIAL/1MISSING, no external acceptance promotion.

## Designer pass
No UI change; no new apply button. Existing repository review browser98 checks
retained. Docs distinguish shared transactional TM from remaining production work.

## Security pass
TM effects share rollback with value/history/activity and use current source in
the same Serializable database snapshot. No external request, credential, account,
spend, license or audience change. Extraction preserves existing normal save/import
semantics. Historical TM retention is explicit, not falsely represented as erasure.

## QA/integration pass
Sync199->207 real-PG checks: rollback covers pair/value/history/activity, exact pair
and key lineage, update without duplicate, historical removal retention, empty
target preservation, base save no target pair, empty and missing source no pair.
API248/30, web48/7, both builds and reaper4 RC0. All43 integration/config legs in14
completed fail-closed batches pass, each individual/outer RC0 (48 sweep inventory
including unit/build/reaper legs). Native visual116+128=244 total,242 unique,
all source assertion labels covered, both inner/outer RC0; checkpoint removed.
Staged verification, not uninterrupted. TM15442/visual15434 test-only overrides.
No failures or host interruptions in this slice. No UI files changed.
