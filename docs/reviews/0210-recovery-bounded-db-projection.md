# 0210 - Bound recovery archive before database transfer

## Developer pass
Diagnostic selects explicit audit metadata and CASE-projected snapshot via bound
UUID parameters. PostgreSQL octet_length(snapshot::text) enforces512KiB before JSON
crosses connection. Oversized row still identifiable but snapshot NULL/size flag
returns unsupported-snapshot. Existing application serialized-size/shape checks stay.
No schema change.

## Product pass
Oversized archive cannot be loaded into API memory just to reject it. PostgreSQL
still evaluates serialized size;not a database CPU/storage bound. JSONB text spaces
count,so near-boundary archives may be conservatively rejected. No restore/token/
history replay,repository effect composition,baseline advance or remote writes.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
No UI changes. Actual current480x900pixel screenshot inspected after browser test:
full UTC snapshot/not-live/refresh/no-reservation/no-restore notice,metadata/button
readable inside card. Upper summary partly under sticky header;full relevant card
visible. Local fixtures,not user/production data.

## Security pass
Real PostgreSQL oversized projection returns small metadata result with snapshot NULL,
not archived payload. HTTP preview remains safe denial200 without value/digest/scope
bytes. Query still binds project and audit UUID;consistent snapshots/current admin
and write guard locks remain. No extra external registration,credential scope,spend,
license/audience or production changes. Raw query type is internal,not public schema.

## QA/integration pass
Sync465->468:oversized HTTP safe denial,actual emitted CASE/project-bound SQL,and
captured actual PostgreSQL result snapshot NULL/size flag/small serialized size.
Initial467RC0 before added result-boundary assertion,enhanced/final468RC0. Existing
malformed/history/shape,writer rollback,races and lock tests remain green. No failures,
startup issues,timeouts or interrupted calls144.

Final43integration/config legs14completed all-green batches,individual/outerRC0.
API248tests/30suites,web65/7,both builds,reaper4RC0. Migration22,sync468,browser138,
automation132,webhook45,135routes. Native staged116+128=244total/242unique labels,
all literal labels covered,inner/outerRC0,checkpoint removed. Staged,not uninterrupted.
No app edits after initial build or broad verification;additional test assertion was
verified before final sweep. Only review added afterward.
