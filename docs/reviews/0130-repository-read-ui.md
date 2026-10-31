# 0130 - Read-only repository snapshot UI

## Developer pass
Read button invokes real target API with expected revision. One busy operation;
clears old snapshot on read/edit/refresh/save/remove/load/destruction. Generation
checks ignore old response/error/finally after project change or destruction.
Readonly JSON plus blob SHA/content digest/client receipt time. Snapshot is kept
only in component memory, not browser storage. Three lifecycle unit tests cover
read failures, late response after scope/destruction, edit/refresh invalidation.

## Product pass
Verified fetched bytes are explicitly not an accepted baseline. No local import,
remote write, sync or credential enrollment. Read requires separately configured
operator access. UI says repository may change after read, no sync connection,
canApply=false behavior retained. README updated for read UI. No coverage promotion
or external acceptance. Client read time is receipt/display time, not upstream
commit time. Existing coordinate configuration flow remains independent.

## Designer pass
Inspected actual desktop and480px full page screenshots after real read. Warning,
read button, snapshot heading, digest wrapping and readonly JSON remain readable
inside card with no document overflow. Snapshot labels distinguish provenance
from accepted baseline. Missing access shows explicit error and removes old bytes
without removing stored config. Existing edit/remove controls remain clear.

## Security pass
No token/password field or new persistent browser data. Repository JSON is a
readonly textarea value, never interpreted as HTML. Real hostile img/event text
does not execute. Session/admin/revision rechecks are server-side. Held successful
read during same-component project navigation cannot render old bytes in new
scope; tests prove server read still real. No guessed live provider acceptance.

## QA/integration pass
Sync browser58->64 checks: real Angular/API/Postgres/mock-repository read, exact
bytes and request count, not-baseline/not-sync warnings, hostile content literal,
480px fit, missing-access503 clearing old snapshot, held successful read after
project navigation. Three unit tests web35->38/7 suites. API244/29 unchanged.
Both builds/reaper4 RC0.43 integration/config legs in nine completed fail-closed
batches all individual/outerRC0; units/builds/reaper give48-leg sweep inventory.
Native visual116+128=244 total/two repeated startups/242 unique, every source
assertion covered, both inner/outerRC0; checkpoint removed. Staged, not
uninterrupted. No failures or interrupted verification this slice. Services clean.
