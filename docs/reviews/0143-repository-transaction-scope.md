# 0143 - Current repository transaction scope guard

## Developer pass
Internal guard requires Serializable, locks project then current membership,
target and accepted baseline. Verifies admin/owner, target revision/branchId/name/
locale, baseline version/targetRevision/SHA/digest. Deterministic lock order mirrors
project-serialized target/acceptance paths. No writer or public endpoint call yet.
Same-transaction composition with local preconditions/writes remains required.

## Product pass
Current account scope guard only, not source of consent, fresh remote verification,
complete apply service or successful sync. No local/repository mutation/baseline
advance. TM/webhook/automation delivery remains integration work. No UI change.
Coverage22FULL/7PARTIAL/1MISSING unchanged; external acceptance not completed.

## Designer pass
No new UI/screenshot. Existing review UI98 browser checks retained. README/plan
state locked transaction scope rather than implying an apply button/reservation.

## Security pass
Current membership checked inside transaction, not trusted from prior preview.
Missing project/member/baseline or changed scope rejected. Locked membership and
baseline rows prevent mid-transaction revocation/replacement from silently passing.
New request after release sees new role/version and fails. Guard is internal;
eventual caller still needs session auth, reviewed fresh source/draft checks and
same-transaction local preconditions/writes. No credential/account/spend changes.

## QA/integration pass
Sync184->193 real PG: actual owner scope, member/outsider/wrong project/revision/
branch/locale denial, baseline version/SHA/digest mismatch, revoked prior admin,
wrong isolation. Real concurrent membership revocation/baseline replacement block
until held guard transaction releases, then stale guard denied. No mocked locks.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs in14 completed
clean fail-closed batches,every individual/outerRC0;48 inventory legs. Browser98
retained. Native visual116+128=244/two repeated startups/242 unique,all source labels
covered,both inner/outerRC0,checkpoint removed,staged not uninterrupted. TM15442/
visual15434 local test ports. No failures/host interruptions. No active services.
