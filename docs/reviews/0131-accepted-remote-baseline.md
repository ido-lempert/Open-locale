# 0131 - Explicit accepted remote baseline API

## Developer pass
One current baseline per target, target cascade, versioned actor/time/bytes/SHA/
digest. Acceptance requires expected target revision, remote SHA/digest and
baseline version (0 initially). Fresh scoped remote read must match reviewed
snapshot. Project-row-lock transaction checks target and baseline version then
upserts, concurrent one winner. Coordinate update atomically deletes baseline.
Bounded bytes inherited from verified flat JSON reader, no caller text stored.

## Product pass
Explicitly selected comparison baseline only, not proof local matches remote or
completed sync. No import, remote write, apply authority or worker. Admin can read
accepted bytes or null. Existing config responses still no sync connection and
canApply=false. Acceptance UI remains next work. No actual deployment credential
or external baseline accepted during development, fixtures only. No coverage
promotion or provider acceptance claim. README explains semantics.

## Designer pass
No UI change or new screenshot. Existing snapshot UI64 browser checks retained.
Errors distinguish stale remote/read-again, stale target/reload and baseline
version/reload. Future UI must show stored accepted baseline separately from
fresh read snapshot and state that acceptance is not synchronization.

## Security pass
Session admin before read and after network, target/project bound. Expected SHA
alone insufficient: digest must match freshly fetched bytes too. No body token/
text accepted. Held read with target revision change/lost admin stores nothing.
Only one bounded current snapshot, no unbounded history. No-store stored-byte
reads. Coordinate update, target/branch/project delete invalidate or cascade
stored bytes. Revision/version are concurrency checks, never execution grants.

## QA/integration pass
Real DB/HTTP sync105->122 checks: initial null, exact stored bytes/actor/version,
read/no-store, no local writes/history, stale version, remote change/forged digest,
concurrent one version winner, role/token/missing input, config invalidation,
held target change/lost admin during acceptance, branch/project byte cascades.
Existing tests retained. API244/29 and web38/7 unchanged; both builds/reaper4 RC0.
43 integration/config legs in ten completed fail-closed batches all individual/
outerRC0 (final sync122 rerun), units/builds/reaper give48-leg inventory. Native
visual116+128=244 total/two repeated startups/242 unique, every source assertion
covered, both stage inner/outerRC0, checkpoint removed. Staged not uninterrupted.
No failures/interrupted verification this slice. No active services retained.
