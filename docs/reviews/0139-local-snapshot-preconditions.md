# 0139 - Same-snapshot local preconditions

## Developer pass
Repository comparison requests local preconditions from the existing repeatable-
read snapshot reader. Key identity/name/update generation/maxLength and translation
rowId/version/value or explicit missing row from the exact rows used for decisions.
All keys included, not only changed values. Fingerprint now binds key metadata
as well as local row generations. Local draft change plan includes this evidence.
No second snapshot or guessed database identity for remote-only keys.

## Product pass
Requires exact local key set for future guarded execution, including unchanged
keys. Preconditions are snapshot evidence, not locks/reservations or permission
to apply. No local mutation, project-key creation/deletion, repository write,
baseline advance or sync completion. Actual atomic apply remains future work.
Coverage22FULL/7PARTIAL/1MISSING unchanged. No external acceptance.

## Designer pass
No UI change/new screenshot. Existing local-change review UI98 browser checks
retained. README/OpenAPI document scope and absence semantics without introducing
apply controls or claiming a reservation. API-only snapshot evidence.

## Security pass
Preconditions sourced server-side, not caller values. Existing session-admin
preview authorization, fresh remote read and post-I/O target/baseline/admin
checks remain. Local snapshot includes unchanged keys to avoid applying a plan
across unknown local additions/removals. Key metadata change invalidates reviewed
fingerprint even when text unchanged. No persistent executable plan or token.
No credential expansion/enrollment/spend/license choice.

## QA/integration pass
Real DB/HTTP sync153->157: actual project/branch/key identity/translation rowId/
version/value binding, no invented remote-only identity, explicit absent-row
precondition, metadata-only change invalidates reviewed draft. Existing stale
remote/local/baseline and no-effects tests retained. API248/30,web48/7,browser98
unchanged,both builds,reaper4 RC0.43 integration/config legs in13 completed
fail-closed batches all individual/outerRC0; units/builds/reaper=48 inventory legs.
TM uses isolated test port15442; native visual both stages15434. Visual116+128=
244/two repeated startups/242 unique, every source label covered,both inner/outer
RC0,checkpoint removed. Staged not uninterrupted. No failures/host interruptions
this slice. No active services retained.
