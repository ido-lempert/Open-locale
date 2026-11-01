# 0198 - Actual recovery concurrency boundaries

## Developer pass
No app changes. Two independent real Prisma connections and Serializable transactions,
held winning transaction,pg_stat_activity actual Lock wait observed before release.
Competing recovery fails exactP2010/40001(or PrismaP2034);normal-create loser fails
exactP2002Translation keyId/localeCode unique target. No stale automatic retry added.

## Product pass
Winning value/identity retained with no duplicate recovery success/history/activity.
This is transaction safety evidence,not public recovery completion. No HTTP/UI endpoint,
repository effects,baseline advance,remote write or accepted sync.22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged.

## Designer pass
No UI change. Current actual480x900audit-focus pixels inspected:heading outline,
notices/button/card metadata readable,no overflow. Deliberate escaped markup key and
2099timestamp fixtures. Browser131existing accessibility/navigation retained.

## Security pass
Exact errors by race kind,not arbitrary rejection accepted. Both actual wait conditions
observed with named connection. One winning row identity,one recovery event only for
recovery winner,no recovery event for normal-create winner. Archive retained,marker
removed only for recovery winner. No registration/token-scope expansion/spend/license/
audience or production data/settings changes.

## QA/integration pass
Sync401->409:each actual race checks wait,denied stale success,winning row+history/
activity counts and archive/marker invariant. Initial408pass/1fail then diagnostic
repeat same:normal-create loser correctlyP2002unique constraint,fixture incorrectly
expected serialization for every race. Narrowed assertion to exactP2002target only
for normal-create;README corrected. App unchanged. Final409RC0. No startup issues,
timeouts or interrupted calls132.

Final43integration/config legs14completed failclosed batches,all individual+outerRC0.
API248/30,web61/7,both builds,reaper4RC0(48nonvisual inventory). Migration17,sync409,
browser131,automation132,webhook45,134routes. Native staged116+128=244total/242unique,
all242literal labels covered,inner+outerRC0,checkpoint removed. Staged,not uninterrupted.
No app changes this slice;only review added after broad verification.
