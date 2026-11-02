# 0226 - Own nested local precondition generations

## Developer pass
After existing snapshot-shape/count checks, copy the top-level typed snapshot,
each key and each non-null translation before the first database await. All later
scope checks, key metadata comparisons and row generation comparisons use the
captured nested snapshot. No JSON serialization or change to null semantics.

## Product pass
The shared validator cannot have its original reviewed generations repaired or
invalidated by caller mutation during database work. No API/UI addition, public
restore execution, remote write, baseline advance or worker change. Coverage
22FULL/7PARTIAL/1MISSING,worker defaultOFF unchanged.

## Designer pass
No UI change. Actual480x900 fixture screenshot inspected: focused result,
target/path/UTC and no-reservation/no-restore notice wrap readably,escaped value
and controls visible,no horizontal overflow. First heading partly behind sticky
header,second card extends below viewport.

## Security pass
Real PostgreSQL query-completion instrumentation mutates nested translation
version after isolation or key-lock query. Valid entry snapshots stay valid after
caller invalidation; stale entry snapshots remain denied when caller repairs to
the actual current version. Four distinct cases plus actual unchanged-row check.
This is internal snapshot boundary hardening,not an HTTP exploit or actual
lock-wait race claim. Old-source control587pass/4expectedfailRC1 exactly those
four cases. Fixed source restored,final591RC0. Writer/composition semantics and
existing outer snapshot copies unchanged.

## QA/integration pass
Sync586->591(+4nested mutation cases,+1unchanged actual translations). Initial/
final591RC0;browser156,API248/30,web77/7,both builds,reaper4 allRC0.
43unique integration/config legs in11completed green batches,each individual and
outerRC0. Migration22,automation132,webhook45,137routes. No startup issues,
timeouts or interrupted calls. Initial combined shell endedRC1 only because a
final grep found no FAIL lines;build/sync/batch wereRC0,not an app failure.
Native visual staged116+128=244total/242unique,all242literal labels present,
inner/outerRC0,checkpoint removed. Staged,not uninterrupted. No app edits after
final integrations;docs only followed. No production/external acceptance claim.
