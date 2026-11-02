# 0225 - Shared repository guard owns its scope

## Developer pass
Copy the scalar-only RepositoryWriteScope at guard entry, before isolation or any
other database await. All subsequent lock predicates, comparisons and returned
actor/project/target bindings use the captured scope. Existing callers that copy
inputs still work; the shared guard now owns this invariant independently.

## Product pass
No API/UI addition, restore action, remote write, baseline advance or worker
change. Coverage remains22FULL/7PARTIAL/1MISSING,worker defaultOFF. This is shared
transaction-boundary hardening, not a new recovery capability or HTTP exploit claim.

## Designer pass
No UI change. Actual480x900 fixture screenshot inspected: focused archived-value
result, target/path/UTC and no-reservation/no-restore notice wrap readably; escaped
value and controls visible without horizontal overflow. First heading partly
behind sticky header; second card extends below viewport.

## Security pass
Real PostgreSQL queries run before instrumentation mutates caller scope actor to
another valid admin, after isolation and project-lock queries separately. Guard
must retain original actor and exact project/target return bindings. This tests
mutation after actual query completion, not an actual lock-wait race. Existing
composition callers already capture their inputs; the shared guard did not.
Old-source negative control584pass/2expectedfail,RC1 exactly these actor checks.
Fixed source restored,final586passRC0. Target/baseline remain unchanged.

## QA/integration pass
Sync583->586 (+2 actor cases,+1 unchanged-target/baseline check). Initial/final586,
RC0. Browser156,API248/30,web77/7,both builds,reaper4 allRC0. All43unique
integration/config legs covered by11completed green batches,each individual and
outerRC0. Migration22,automation132,webhook45,137routes. No startup issues,
timeouts or interrupted calls this slice. No failures outside intentional control.
Native visual staged116+128=244total/242unique,all242literal labels present,
inner/outerRC0,checkpoint removed. Staged,not uninterrupted. No app changes after
final integration verification; only documentation followed. No external acceptance.
