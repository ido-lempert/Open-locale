# 0205 - Capture recovery scope before asynchronous guards

## Developer pass
Shared typed DeletionRecoveryScope contains primitive bindings only. Guard and writer
copy scope at entry before first await. Writer retains its private copy throughout
lock validation,audit read,row/history/activity/TM writes and generation deletion.
Guard also works independently without trusting caller object identity.

## Product pass
Caller mutation during a wait cannot redirect project/actor/audit or reviewed key
bindings. This does not grant recovery authority or add a public mutation. No history
replay,repository effect composition,baseline advance or remote writes. Coverage
22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
No UI changes. Current actual480x900pixel eligibility screenshot inspected after
browser test:full UTC snapshot/not-live/refresh/no-reservation/no-restore notice,
metadata/button readable inside card. Upper summary partly behind sticky header;
full relevant card/notice visible. Local fixtures,not user/production data.

## Security pass
Actual PostgreSQL wait gives caller time to mutate every supplied binding to other
project/actor/audit/branch/digest/timestamp/revision. Entry capture preserves validated
scope for both independent guard and writer. Expected plain typed primitive scope,
not arbitrary hostile runtime getters/proxies. Serializable locks,current admin
checks,revision and digest guards remain unchanged. No additional secret scope,
external registration,spend,license/audience or production changes.

## QA/integration pass
Sync437->443 adds two actual socket/connection PostgreSQL lock waits,entry-scope
results,and rollback invariants for guard/writer. Deliberate negative control removed
both copy lines:441pass/2expectedfail,exact guard/writer binding assertions. Restored
fix,final443RC0. No unplanned failures,startup issues,timeouts or interrupted calls.

Final43integration/config legs14completed failclosed batches,individual and outerRC0.
API248tests/30suites,web65/7,both builds,reaper4RC0. Migration22,sync443,browser138,
automation132,webhook45,135routes. Native staged116+128=244total/242unique labels,
all literal labels covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted.
App fix initially built/tested;negative-control source restored byte-for-byte before
final broad verification. No app edits after restoration;only review added afterward.
