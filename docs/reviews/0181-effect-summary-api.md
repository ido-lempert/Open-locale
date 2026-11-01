# 0181 - Target effect bookkeeping summary API

## Developer pass
GET effects-summary authorizes signed-in project admin and verifies target belongs
to that project. One aggregate query filters both projectId and targetId; DB clock
sampled once. Counts pending/leased/completed/dead,expired leases (deadline<=clock),
oldest pending creation time,asOf. Empty queue produces zeros/null. Safe-integer
conversion fails unavailable instead of silently rounding. No payload fetch,queue
mutation or external I/O. Authorization is point-in-time,not a held permission lock.
Historical target revisions intentionally included;terminal retention limits history.

## Product pass
Operators gain queue visibility without enabling workers. completed/dead describe
handler bookkeeping,not receiver delivery or accepted sync;response explicitly
states deliveryConfirmed=false/syncAccepted=false. No retry endpoint,enablement
inference or UI summary this slice. README/spec explain revision and retention
semantics. Route count132->133.22FULL/7PARTIAL/1MISSING unchanged. No remote write,
baseline advance,accepted sync or external-account acceptance.

## Designer pass
No web screen added or changed. Existing480x900 local-apply confirmation pixels
inspected directly:full scope,digest,effect notice and separate actions readable,
no horizontal overflow. Screenshot attached to parent as existing-screen evidence,
not a summary UI. Browser108 actual apply/cancel/removal/navigation checks retained.

## Security pass
Session-only guard rejects API token even with read/write scope. Contributor403,
outsider404,unauth401;unknown/cross-project target404,badUUID400. Aggregate SQL binds
UUID parameters. Exact response whitelist excludes actor,key/value,lease token,
individual rows and error text. Seeded matching targetId under another project and
other target under same project excluded. No-store on success. No new credential,
spend,registration,license or audience changes. Endpoint never dispatches work.

## QA/integration pass
Sync305->319 adds14actualHTTP checks:empty,mixed states,expired/live leases,oldest
pending,asOf,session/admin/contributor/outsider/API-token,unknown/malformed target,
no-store,exact payload whitelist,no mutation,old-coordinate-revision inclusion,
cross-project target denial. Cross-project and other-target forged intents excluded
inside mixed count assertion. Actual seeded rows cleaned after checks. Initial318,
final319RC0. No application assertion failure.

Final43integration/config legs14completed fail-closed batches,all individual+outer
RC0. API248/30,web52/7,both builds,reaper4RC0. Migration13,sync319,browser108,
automation123,webhook45. Native staged116+128=244total/242unique,all242literal
source labels covered,inner+outerRC0,checkpoint removed;not uninterrupted.

Fixture failures:permissions initial startupRC1/0checks,55454briefly occupied;no
visible owner at inspection,no cleanup;entire d batch50checksRC0.2fa default55474
startupRC1/0checks twice,address-in-use with no visible owning process. Added
optional TWO_FACTOR_TEST_PG_PORT test-harness override,15474standalone37RC0. No
production port/service changes,no timeouts/interrupted runs. All other final
batches clean. No app change after final broad run,only final14thHTTP test and
this review record;lm319+108 rerun after test addition.
