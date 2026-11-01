# 0176 - Typed expected local apply denials

## Developer pass
Explicit RepositoryLocalError class carries conflict/unsupported/backlog kind.
Origin checks emit it;service maps known kinds to safe400/409 messages,never error
text matching. Invalid internal isolation/invariant errors stay unexpected500.
Prisma known P2034 maps409 without retry. Unknown errors rethrow so storage faults
are not disguised as expected denials. Existing domain error messages retained for
internal diagnostics/tests. Remote-only key rejection typed at pure planner origin.

## Product pass
Unsupported existing-key operation/length/deletion audit limits400;stale locked
scope/generation/admin/target/baseline and backlog409. No automatic retry or reuse
of stale review. Unexpected storage faults500/atomic rollback. This corrects prior
local API rough edge,not expanded sync coverage. Worker defaultOFF,no remote writes,
baseline advance or accepted sync.22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI layout change. Current480x900 confirmation pixels inspected directly:wrapped
digest/scope,effect warning and separated action controls readable,no overflow.
Browser108 retains actual confirmation/cancel/set/removal/navigation evidence.
README/OpenAPI name expected denials and distinguish unexpected storage failures.

## Security pass
Only explicit domain class and Prisma known code classified;arbitrary DB text is
not exposed. Client messages omit private key/row details. Role revocation maps
conflict at commit,does not authorize retry. No raw SQL error maps to success.
Typed failures still occur within atomic transaction. No credential/scope/spend/
registration/license/audience changes. Existing auth/provenance/authority unchanged.

## QA/integration pass
Sync295->298: actual HTTP length-limit400,unsupported remote-only key400 with no
partial existing-key write,actual10000pending backlog409 with no value/intent write.
Post-resolution baseline/admin/local mutation tests now assert409 (seams reached).
Existing actual trigger storage failure still500/atomic rollback. P2034 mapping is
code path only,no claim this slice induced actual serialization conflict.
Initial module-resolution RC1/zero checks: direct Node TS imports acquired an
extensionless dependency;bundled those harness imports consistently with other
modules. Next oneFAIL revealed remote-only key rejection happened in pure planner
before writer,still generic;typed origin denial,297clean. Backlog added298clean,
then final298clean/full sweep298clean. No host interruption110.
API248/30,web52/7,both builds,reaper4RC0.43integration/config legs14completed
fail-closed batches,all individual/outerRC0;48inventory. Webhook45,migration10,
automation116,sync298/browser108. Native staged116+128=244total/242unique,all242literal
source labels covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted.
No live fixture services/temp bundles.
