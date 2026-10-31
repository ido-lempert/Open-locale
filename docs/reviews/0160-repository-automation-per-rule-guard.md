# 0160 - Current repository intent before each automation rule

## Developer pass
Optional internal beforeRule hook is awaited before runRule; thrown rejection
stops remaining rules through existing failed summary. Repository adapter uses the
same Serializable current-intent guard initially and per rule. Transactions end
before rule effects. Normal callers omit options. Rules now run deterministically
by createdAt then id (previous DB order unspecified), allowing reproducible
sequential processing. No per-rule completion ledger or worker added.

## Product pass
After target change or lease expiry between rules, already committed effects
remain but subsequent rules do not run. This is point-in-time eligibility, not
post-check race elimination, rollback, exactly-once or retry deduplication. Public
repository execution, baseline advance, remote write and external acceptance stay
outstanding. Coverage22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI added. Existing native editor screenshot at1280x800 inspected: locale columns,
saved state and memory suggestion readable without overlap. No new visual feature
claim. Documentation states partial-effect boundary and remaining code work.

## Security pass
Revalidate lease token/deadline, current actor admin, target revision, key lineage,
locale and value generation before every rule. Abort stops further effects rather
than just changing bookkeeping. No DB locks across effects. Scope can change after
a check; rule/receiver retry internals are not guarded by this hook. Captured rule
config freshness is separate remaining hardening. Generic aggregate error retained.
No registration, credential scope, spend, license or audience change.

## QA/integration pass
Automation42->46. Actual PostgreSQL mutation in first committed automation activity
changes target revision or expires lease. In both cases first task/activity exists,
second actual task absent and activity count exactly+1, adapter fails. Activity
wrapper injects mutation but delegates real activity service inside transaction;
not a production receiver/provider acceptance claim. Existing46 checks clean.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs in14 final
clean fail-closed batches,all individual/outerRC0 (d,g final reruns;h standalone
retry);48 inventory. Webhook45,sync268,sync-browser98. Native116+128=244 total/
242 unique,all242 literal source labels covered,inner/outerRC0,checkpoint removed.
Staged,not uninterrupted. No active fixture services/temp bundles on completion.

Interim chronology: shell safety rejected unbraced positional syntax before test
loop execution; corrected braces. Initial snapshots exitedRC1/zero checks because
TCP55452 occupied; later bind free,28 clean,then full d batch clean. Combined g+h
call hit120sec host limit after g sentinel during2FA: partial2FA not success.
Verified TCP55474 free/socket owner5454 zombie; removed stale fixture socket,
standalone2FA37RC0. Re-ran g in bounded call to obtain outerRC0. These are fixture/
execution issues,not app fixes or an uninterrupted initial green sweep.
