# 0180 - Ordered terminal retention index

## Developer pass
Terminal-only partial finishedAt/id index matches ordering and eligibility; pending
and leased rows excluded. Broad nonpartial index initially lost planner selection
against state index and sort. Fixed to partial index plus a single DB wall-clock
cutoff initplan. Production prune tagged query itself supplied to EXPLAIN, no copied
SQL drift. Actual PG chooses ordered partial index/no Sort with 10k pending,
10k recent terminal and205expired rows. Planner is free to choose another path on
other distributions; no strict total scan/runtime bound. Existing lock/rollback/
concurrent batch semantics retained. Schema documents SQL-only predicate.

## Product pass
No new public route, flag or behavior beyond efficient existing optional cleanup.
DefaultOFF remains; no deployment flags enabled or production records deleted.
Migration is ordinary transactional CREATE INDEX, not concurrent: writes may wait
on large tables. README now explicitly recommends maintenance window. No remote
write, baseline advance, accepted sync or external-account acceptance.
22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No UI change. Actual480x900 confirmation screenshot inspected: full scope, digest,
effect notice and separately spaced actions readable with no horizontal overflow.
Browser108 still proves apply/cancel/removal/navigation flows; native staged pass
retains full242literal labels. Screenshot attached to parent, not claimed new UI.

## Security pass
Index holds only terminal timestamps and IDs, no new disclosure or network effect.
Eligibility filter and row locks remain in production query. DB clock sampled once
per cleanup statement rather than per candidate; seven-day policy unchanged.
Pending/leased never age-pruned. Migration checkpoint/payload preservation tested.
No credential scope, spend, registration, license or audience change.

## QA/integration pass
Migration10->13 preserves existing terminal value/state/raw timestamp and successful
rule checkpoint and verifies partial ordered index definition. Initial timestamp
assertion failed because PG timestamp-without-timezone parsed as local JS Date;
fixture compares raw text now. Sync304->305 adds exact-production-query EXPLAIN over
mixed20208rows. Initial broad-index plan failed, as did cutoff-only intermediate;
partial-index fix green. Existing actual pruning/skip-lock/concurrent/rollback and
API serialization/lock-timeout tests retained.

Final43integration/config legs14completed fail-closed batches,all individual+outer
RC0. API248/30,web52/7,both builds,reaper4RC0. Migration13,sync305,automation123,
webhook45,browser108. Native staged116+128=244total/242unique,all242literal source
labels covered,inner/outerRC0,checkpoint removed;not uninterrupted.

Verification interruptions: wrong reaper filename initiallyRC2,corrected Python4
RC0. Combined f1+automation120sec timeout after f1completed;dead55470socket caused
standalone automation startupRC1/0checks;verified dead owner/closedport,removed
fixture socket,123RC0. Combined g+2fa timeout after g completed;dead55474socket
caused standalone2fa startupRC1/0checks;verified/removed,37RC0. Third combined call
timeout after2fa37+sync305 interrupted browser startup;dead55479socket caused
browser suite abort(rc0/FAILline/0checks),fail-closed wrapperRC1. Verified/removed,
clean lm305+108RC0. No production service or data affected. No app changes after
final verification other than this review record.
