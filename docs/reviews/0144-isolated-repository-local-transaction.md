# 0144 - Isolated reviewed local transaction composition

## Developer pass
Composition snapshots input before awaits, binds exact draft bytes/SHA256 and
reviewed fingerprint, checks project/branchId/name/locale consistency. Re-derives
operations from draft/local snapshot, never caller changes. Current locked admin/
target/baseline guard then local locks/writes in same Serializable transaction.
Existing-key-only; remote-only key creation refused before writes. No public caller.

## Product pass
Transactional groundwork, not complete sync or public apply. No fresh remote reader,
TM updates, webhook/automation delivery or successful-sync record. No baseline
advance/remote write. Eventual caller must authenticate, obtain trusted freshly
reviewed sources and integrate remaining effects. Coverage22FULL/7PARTIAL/1MISSING
unchanged, no external acceptance or new authority implied by fingerprint.

## Designer pass
No UI/new screenshot. Existing local review UI98 checks retained. README/plan name
isolated composition and missing production responsibilities, no apply control.

## Security pass
Input mutation during async guards cannot change snapshot. Exact byte digest and
scope mismatch rejected before writes. Current non-admin denied in transaction.
Local key/row generations make replay after actual change fail, no duplicate audit.
Fingerprint supplied internally is consistency evidence, not authentication/consent.
No new endpoint/credential/account/spend/license effects.

## QA/integration pass
Sync193->199 real PG: altered bytes/digest/fingerprint/local scope denied,current
non-admin no write,post-write failure rolls back value/history/activity,exact
commit through both guards,replay stale/no duplicate audit,baseline/remote no-write
posture. Actual source bundled via bounded CLI for fixture; no mocked transaction.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs in14 completed
clean fail-closed batches,every individual/outerRC0;48 inventory legs. Browser98
retained. Native visual116+128=244/two repeated startups/242 unique,all source labels
covered,both inner/outerRC0,checkpoint removed;staged not uninterrupted. TM15442/
visual15434 isolated test ports. No failures/host interruptions. No active services.
