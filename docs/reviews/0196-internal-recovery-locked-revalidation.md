# 0196 - Internal locked recovery revalidation

## Developer pass
Serializable-only guard;project then current team member,project-scoped audit,key,
locale,removal generation and current translation row locks. Re-runs diagnostic and
binds expected SHA256 value digest after locks. SET LOCAL lock_timeout2s prevents
unbounded per-lock waits,not total request bound. No writer/HTTP endpoint. Future
writes must remain in same transaction and handle serialization failure:row locks
do not reserve absent rows. No stale automatic retry authorization.

## Product pass
Internal preparatory safety building block,not restore completion/grant. Current
owner/admin required,revocation re-read. Existing metadata API/UI canRestore=false
unchanged. No history replay,baseline advance,remote write,accepted sync or external
acceptance.22FULL/7PARTIAL/1MISSING coverage/defaultOFF unchanged.

## Designer pass
No UI changes or recovery UI claim. Current actual480x900audit-focus pixels inspected:
outline/heading/notices/button/card metadata readable,no overflow. Escaped markup key
and2099timestamp deliberate fixtures. Browser131retains actual keyboard/navigation flow.

## Security pass
Default isolation,bad/stale digest,contributor,outsider,wrong project denied. Actual
in-transaction admin revocation and generation replacement denied/rolled back. Real
project/audit/key/locale/generation blockers yield exact PrismaP2010/SQLSTATE55P03,
never success;after release guard recovers. Archive/current absence unchanged. No
registration,token-scope expansion,spend,license/audience or production actions.

## QA/integration pass
Sync377->394:owner/admin success without execution grant,default isolation denial,
five invalid scope/digest cases,revocation,generation replacement,five actual lock
blockers,post-release recovery,and archive/absence invariance. Initial392,expanded394
RC0. No failures,startup issues,timeouts/interruption130 (expected DB lock denials
are test success,not suite failures).

Final43integration/config legs14completed failclosed batches,all individual+outerRC0.
API248/30,web61/7,both builds,reaper4RC0(48nonvisual inventory). Migration17,sync394,
browser131,automation132,webhook45,134routes. Native staged116+128=244total/242unique,
all242literal labels covered,inner+outerRC0,checkpoint removed. Staged,not uninterrupted.
No app edits after broad verification;only review added afterward.
