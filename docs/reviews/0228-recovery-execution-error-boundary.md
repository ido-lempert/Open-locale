# 0228 - Explicit recovery execution error boundary

## Developer pass
Await the one internal Serializable composition transaction inside a typed catch.
Domain unsupported maps400;domain conflict/backlog maps409. Exact Prisma known
P2010/55P03 maps busy409;P2034 or P2010/40001 maps concurrent409. Unknown errors
retain identity and remain faults. No refresh or retry of reviewed bindings.

## Product pass
Recoverable denials tell a future caller to review again rather than present a
storage fault. Still internal service only,no public restore route/UI action,
remote write,baseline advance or worker enablement. Coverage22FULL/7PARTIAL/
1MISSING,worker defaultOFF unchanged.

## Designer pass
No UI change. Inspected actual480x900 fixture screenshot:focused result,target/
path/UTC and no-reservation/no-restore notice wrap readably,escaped value and
controls visible,no horizontal overflow. First heading partly behind sticky
header;second card extends below viewport.

## Security pass
Only typed domain/Prisma known errors get classified,not message matching or
untyped code lookalikes. Actual PostgreSQL project lock timeout55P03 and actual
snapshot/update serialization40001 each map409 with one transaction attempt and
unchanged recovery counts. Actual unsupported revision and8MiB pending backlog
map400/409 with rollback. TypedP2034 classification is injected,not an actual
ORM-generated P2034 claim. Untyped55P03 lookalike and unrelated typed23505 preserve
original error identity. Existing injected storage fault still rolls back once.

## QA/integration pass
Sync595->602(+2domain,+2actual PG,+3classification). Initial599 before last3
classification checks;final602RC0. Old-source control594pass/8expectedfailRC1:
stale-key,revocation,unsupported,backlog,55P03,40001,P2034,replay status assertions.
Fixed source restored. All43unique integration/config legs in11completed green
batches,individual/outerRC0. Browser156,API248/30,web77/7,both builds,reaper4,
137routes allRC0. Migration22,automation132,webhook45. No startup issues,timeouts
or interrupted calls;no unrelated failures. Native staged visual116+128=244total/
242unique,all242literal labels present,inner/outerRC0,checkpoint removed. Staged,
not uninterrupted. No app edits after final integrations;docs only followed.
No production/external acceptance claim.
