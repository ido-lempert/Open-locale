# 0148 - Current-scope and value-generation effect eligibility

## Developer pass
New intents bind target revision and resulting translation row/version inside the
write transaction. Nullable migration fields make legacy intents fail closed.
Internal Serializable guard locks intent/project/admin membership/target/key/value,
checks exact current lineage and generation, and rechecks database lease expiry
after scope locks. No network under locks. Guard is point-in-time evidence only;
later state changes still require handler routing/authority/deduplication work.

## Product pass
No enabled worker, webhook/automation dispatch or public apply. Superseded value
and removal effects are refused; key/target lineage retention does not imply
continued authority. Legacy missing revision evidence refused, not guessed. No
baseline advance, remote write or external acceptance;22FULL/7PARTIAL/1MISSING
unchanged. Dispatcher and terminal retention remain code work.

## Designer pass
No UI change or apply button. README/plan distinguish internal current eligibility
from delivery permission. Browser98 retained, no new queue UI screenshot claim.

## Security pass
Current actor admin rechecked, target revision/project/branch/locale and key exact
lineage/flat-only checked, project locale required. Set value requires exact rowId,
version and text, defeating value ABA and same-value row recreation. Removal needs
continued absence and null generation/value. Wrong/expired token, weak isolation
and missing generation fail closed. Final expiry check covers time consumed by
locks. No endpoint/credentials/new external audience or permanent execution grant.

## QA/integration pass
Sync231->247 real PG. Exact committed generation accepted; wrong/expired token,
legacy revision,revoked admin,changed/deleted target,renamed/plural key,value ABA,
recreated row,removed locale,weak isolation rejected. Deterministic expiry injection
after initial locked lease read proves final recheck, using real DB/actual guard
with intercepted query boundary (not claimed as transport or lock-wait coverage).
Removal accepted only during absence; recreated locale rejected. Both assertions
run outside rollback callback to prevent swallowed errors skipping assertions.
API248/30,web48/7,both builds/reaper4 RC0.43 integration/config legs in14 clean
fail-closed batches,all individual/outerRC0,48 sweep inventory. Browser98 retained.
Native visual116+128=244 total/242 unique,all242 source labels covered,inner/outer
RC0,checkpoint removed. Staged,not uninterrupted. TM15442/visual15434 test ports.

Interim failures: three timed contention fixture attempts yielded initial lease
unavailable, not the intended final-expiry boundary (244 PASS/1 FAIL each). Replaced
with deterministic mid-guard database expiry. Review found removal checks inside
swallowed rollback callback could be skipped; moved outside, exposing two FAILs
(245 PASS) because the JS-date fixture lease was already unavailable to database
time. Fixture now sets its deadline with database clock; final247 all executed,
RC0. No assertion weakened or production expiry bypassed. No host interruptions.
