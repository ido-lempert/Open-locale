# 0137 - Local draft change materialization

## Developer pass
Shared pure local-draft planner derives deterministic changes from freshly
recomputed repository comparison decisions and selected draft bytes. Each change
retains expected local value and next value; null differs from empty string.
Sorted output, exact draft digest and reviewed fingerprint binding. No mutating
input order, persistence, transaction or execution path. Extra draft keys and
duplicate decision keys rejected; existing flat parser/bounds remain in force.

## Product pass
Draft response includes localChangePlan set/removal/unchanged counts and changes.
Absence means remove-locale-value only, never delete a project key or touch other
locales. canApply=false remains explicit. This is review data, not execution
permission, successful sync or accepted new baseline. Actual apply remains work.
Coverage22FULL/7PARTIAL/1MISSING unchanged; no external acceptance.

## Designer pass
No UI change or new screenshot. Existing draft UI92 browser checks retained.
README/OpenAPI explain localChangePlan semantics and no effects. No speculative
apply controls or status claims introduced. API-only materialized change data.

## Security pass
Planner accepts only server-derived decisions/draft through existing session-admin
resolve endpoint, never arbitrary caller localChangePlan/expected values. Existing
fresh remote/local/baseline fingerprint/rechecks remain. No repository writes,
key deletion or cross-locale mutation. Flat parser rejects reserved prototype-like
keys; initial new test wrongly expected one accepted, corrected to enforce current
rejection rather than relax parser. No credential expansion/enrollment/spend.

## QA/integration pass
API244/29->248/30: absent/empty/set/removal/unchanged, deterministic sort without
input mutation, exact digest/binding, no-op, reserved-key/extra/duplicate/unsupported
input rejection. Initial reserved-key expectation failed; test corrected, clean248.
Real PG/HTTP sync150->153: exact set plan/digest/fingerprint, explicit absent local
value removal without key/other-locale deletion, no-op local plan; existing no-write
and stale-source tests retained. Web47/7,browser92 unchanged,both builds,reaper4 RC0.
43 integration/config legs in13 completed fail-closed batches all individual/outer
RC0; units/builds/reaper give48 sweep inventory legs. Native visual116+128=244/two
repeated startups/242 unique, every source label covered,both inner/outerRC0,
checkpoint removed. Explicit local test port55483, staged not uninterrupted.
No host interruption this slice. No active services retained.
