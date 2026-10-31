# 0135 - Repository comparison draft resolution API

## Developer pass
Session-admin target endpoint recomputes the existing accepted-baseline repository
preview, checks reviewed fingerprint, then reuses shared explicit-choice resolver.
No duplicate snapshot, diff or draft algorithm. Requires target revision,64-hex
fingerprint and object choices. Every differing key needs base/local/remote;
unchanged/converged values preserved. Exact deterministic JSON and SHA256 digest.
Combined draft retains parser bounds. No new persistence or effects.

## Product pass
API-only draft preparation, not sync/apply. Selected absence removes a draft key
only. Provenance describes explicitly accepted comparison baseline and fresh
verified remote bytes, never local=remote, completed sync or execution authority.
No baseline advance, translation import, repository write or diagnostic record.
Repository draft UI remains future work. Coverage22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI change or new screenshot. Existing comparison UI83 browser checks retained.
Changed fingerprint returns fresh-comparison409; invalid/missing/extra choices400.
README/OpenAPI explain exact input and no-effect semantics, no misleading button
or new success UI. Repository comparison screen remains read-only.

## Security pass
Authorization precedes target/read access through shared preview. No caller file,
local value, actor or credential used. Fingerprint binds target/configuration,
accepted baseline, local row generations and remote bytes. Fresh authorized
read rechecks target/baseline/admin after I/O. Held baseline/target/admin changes
suppress draft disclosure. No-store response. No enrollment/scope expansion,
spend or external provider action. Draft provenance is not permission to apply.

## QA/integration pass
Sync133->150 real PG/HTTP checks include exact selected draft bytes/digest,
absence, no-apply posture, forged files/actor ignored, missing/extra/invalid choices,
DTO fields, missing baseline before I/O, changed remote/local-generation/baseline,
member/outsider/API-token/stale-revision denial before I/O, held baseline/target/
admin changes, no-store and no translation/history/baseline/repository writes.
Initial exact-byte assertion compared unsorted expected object order to sorted
deterministic draft; fixture fixed to assert sorted exact JSON, clean reruns150.
API244/29,web44/7,both builds,reaper4 RC0.43 integration/config legs in13 completed
fail-closed batches, all individual/outerRC0, plus units/builds/reaper=48 inventory
legs. Native visual116+128=244/two repeated startups/242 unique, every source
assertion covered, both inner/outerRC0, checkpoint removed. Staged not uninterrupted.
No host interruption or application failure this slice. External acceptance open.
